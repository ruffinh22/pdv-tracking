import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, X, Eye, EyeOff, ArrowUp, ArrowDown, ListChecks, Lock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  pdvAttributService,
  PdvAttribut,
  PdvAttributType,
  TYPE_LABELS,
} from '../services/pdvAttributService';
import { pdvChampFixeService, PdvChampFixe } from '../services/pdvChampFixeService';

const TYPES_AVEC_OPTIONS: PdvAttributType[] = ['liste', 'liste_multiple'];

interface FormState {
  libelle: string;
  type: PdvAttributType;
  optionsTexte: string;
  obligatoire: boolean;
  groupe: string;
  aide: string;
  actif: boolean;
}

const FORM_VIDE: FormState = {
  libelle: '',
  type: 'texte',
  optionsTexte: '',
  obligatoire: false,
  groupe: 'Informations complémentaires',
  aide: '',
  actif: true,
};

const PdvAttributs = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PdvAttribut | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VIDE);

  const { data: attributs = [], isLoading } = useQuery({
    queryKey: ['pdv-attributs'],
    queryFn: () => pdvAttributService.getAll(false),
  });

  const { data: champsFixes = [], isLoading: chargementChampsFixes } = useQuery({
    queryKey: ['pdv-champs-fixes'],
    queryFn: pdvChampFixeService.getAll,
  });

  const champFixeMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<PdvChampFixe> }) =>
      pdvChampFixeService.update(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdv-champs-fixes'] });
      // Les fiches PDV ouvertes doivent immédiatement refléter la nouvelle
      // visibilité / obligation d'un champ.
      queryClient.invalidateQueries({ queryKey: ['pdv'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la mise à jour'),
  });

  /**
   * Masquer/démasquer un champ fixe. Masquer un champ obligatoire le rend
   * aussi facultatif côté serveur (un agent ne peut pas remplir un champ
   * qu'il ne voit pas) : on le redemande explicitement ici pour que
   * l'affichage optimiste du tableau suive tout de suite, sans attendre la
   * réponse serveur.
   */
  const basculerVisibiliteChampFixe = (champ: PdvChampFixe) => {
    const visible = !champ.visible;
    champFixeMutation.mutate({
      code: champ.code,
      data: visible ? { visible } : { visible, obligatoire: false },
    });
  };

  const basculerObligatoireChampFixe = (champ: PdvChampFixe) => {
    if (!champ.visible) return; // Bouton désactivé dans ce cas, filet de sécurité.
    champFixeMutation.mutate({ code: champ.code, data: { obligatoire: !champ.obligatoire } });
  };

  const invalider = () => {
    queryClient.invalidateQueries({ queryKey: ['pdv-attributs'] });
    // Les fiches PDV ouvertes doivent refléter immédiatement le nouveau schéma.
    queryClient.invalidateQueries({ queryKey: ['pdv'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<PdvAttribut>) => pdvAttributService.create(data),
    onSuccess: () => {
      invalider();
      fermer();
      toast.success('Attribut créé');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PdvAttribut> }) =>
      pdvAttributService.update(id, data),
    onSuccess: () => {
      invalider();
      fermer();
      toast.success('Attribut mis à jour');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la mise à jour'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => pdvAttributService.remove(id),
    onSuccess: (data) => {
      invalider();
      toast.success(
        data.valeurs_supprimees > 0
          ? `Attribut supprimé (${data.valeurs_supprimees} valeur(s) effacée(s))`
          : 'Attribut supprimé'
      );
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const reorderMutation = useMutation({
    mutationFn: (ordres: { id: number; ordre: number }[]) => pdvAttributService.reorder(ordres),
    onSuccess: invalider,
  });

  const fermer = () => {
    setShowModal(false);
    setEditing(null);
    setForm(FORM_VIDE);
  };

  const ouvrirCreation = () => {
    setEditing(null);
    setForm(FORM_VIDE);
    setShowModal(true);
  };

  const ouvrirEdition = (attribut: PdvAttribut) => {
    setEditing(attribut);
    setForm({
      libelle: attribut.libelle,
      type: attribut.type,
      optionsTexte: (attribut.options || []).join('\n'),
      obligatoire: attribut.obligatoire,
      groupe: attribut.groupe,
      aide: attribut.aide || '',
      actif: attribut.actif,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Une option par ligne : plus lisible qu'une saisie séparée par virgules
    // quand les libellés contiennent eux-mêmes des virgules.
    const options = form.optionsTexte
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);

    if (TYPES_AVEC_OPTIONS.includes(form.type) && options.length === 0) {
      toast.error('Renseignez au moins une option pour ce type de champ');
      return;
    }

    const payload: Partial<PdvAttribut> = {
      libelle: form.libelle,
      type: form.type,
      options: TYPES_AVEC_OPTIONS.includes(form.type) ? options : undefined,
      obligatoire: form.obligatoire,
      groupe: form.groupe || 'Informations complémentaires',
      aide: form.aide || null,
      actif: form.actif,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (attribut: PdvAttribut) => {
    // La suppression emporte les valeurs saisies sur tous les PDV : on le dit
    // explicitement, et on rappelle l'alternative non destructive.
    const ok = window.confirm(
      `Supprimer définitivement « ${attribut.libelle} » ?\n\n` +
        'Toutes les valeurs déjà saisies pour ce champ, sur tous les PDV, seront effacées. ' +
        "Pour retirer ce champ du formulaire sans rien perdre, désactivez-le à la place."
    );
    if (ok) deleteMutation.mutate(attribut.id);
  };

  const basculerActif = (attribut: PdvAttribut) => {
    updateMutation.mutate({ id: attribut.id, data: { actif: !attribut.actif } });
  };

  /** Échange la position d'un attribut avec son voisin. */
  const deplacer = (index: number, direction: -1 | 1) => {
    const voisin = index + direction;
    if (voisin < 0 || voisin >= attributs.length) return;
    reorderMutation.mutate([
      { id: attributs[index].id, ordre: voisin },
      { id: attributs[voisin].id, ordre: index },
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Attributs PDV</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Champs du formulaire de complétion d'un dossier point de vente
          </p>
        </div>
        <button onClick={ouvrirCreation} className="btn btn-primary">
          <Plus className="w-4 h-4 mr-1.5" />
          Nouvel attribut
        </button>
      </div>

      {/* ---- Champs standards : vraies colonnes de la fiche PDV --------------
          Contrairement aux attributs ci-dessous, ceux-ci ne peuvent pas être
          créés ni supprimés — seulement masqués ou rendus facultatifs. */}
      <div>
        <h2 className="text-lg font-bold text-ink-900 mb-1">Champs standards</h2>
        <p className="text-sm text-ink-500 mb-3">
          Champs déjà présents sur la fiche PDV (identité, rattachement commercial, localisation,
          produits vendus). Vous pouvez les masquer ou les rendre facultatifs, mais pas les
          renommer en profondeur, les supprimer ou changer leur nature.
        </p>

        <div className="card !p-4 !bg-warning-50 !border-warning-200 mb-3">
          <div className="flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
            <p className="text-xs text-ink-700 leading-relaxed">
              <strong>Plusieurs de ces champs alimentent l'export CSV du mapping standard</strong>{' '}
              envoyé au partenaire (Vendeur, Contact, Pays, Ville, Agence, Superviseur, Chef de
              zone, Sous-zone, ID Distributeur, Produits vendus). L'export s'adapte maintenant
              automatiquement : masquer l'un de ces champs retire directement sa colonne du fichier
              (plutôt que de la laisser vide) ; le rendre facultatif ne change rien à l'export tant
              qu'il reste visible. C'est un choix assumé, pas une erreur, mais mieux vaut le savoir
              avant de cliquer — le partenaire peut ne pas s'attendre à recevoir un fichier avec
              moins de colonnes.
            </p>
          </div>
        </div>

        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th>Champ</th>
                  <th>Obligatoire</th>
                  <th>État</th>
                  <th className="text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {chargementChampsFixes ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-ink-400">
                      Chargement…
                    </td>
                  </tr>
                ) : (
                  champsFixes.map((champ) => (
                    <tr key={champ.code} className={champ.visible ? '' : 'opacity-50'}>
                      <td>
                        <div className="font-medium text-ink-900 flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-ink-300" />
                          {champ.libelle}
                        </div>
                      </td>
                      <td>
                        <code className="text-xs text-ink-500">{champ.code}</code>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => basculerObligatoireChampFixe(champ)}
                          disabled={!champ.visible || champFixeMutation.isPending}
                          className={
                            champ.obligatoire
                              ? 'badge badge-warning cursor-pointer disabled:cursor-not-allowed'
                              : 'badge badge-neutral cursor-pointer disabled:cursor-not-allowed'
                          }
                          title={
                            !champ.visible
                              ? 'Un champ masqué ne peut pas être obligatoire'
                              : champ.obligatoire
                              ? 'Cliquer pour rendre facultatif'
                              : 'Cliquer pour rendre obligatoire'
                          }
                        >
                          {champ.obligatoire ? 'Obligatoire' : 'Facultatif'}
                        </button>
                      </td>
                      <td>
                        <span className={champ.visible ? 'badge badge-success' : 'badge badge-neutral'}>
                          {champ.visible ? 'Affiché' : 'Masqué'}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => basculerVisibiliteChampFixe(champ)}
                            disabled={champFixeMutation.isPending}
                            className="btn-icon hover:text-primary-600 hover:bg-primary-50"
                            title={champ.visible ? 'Masquer du formulaire' : 'Afficher dans le formulaire'}
                          >
                            {champ.visible ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-ink-900 mb-1">Attributs personnalisés</h2>
        <p className="text-sm text-ink-500 mb-3">
          Champs ajoutés par l'administrateur, en plus des champs standards ci-dessus.
        </p>
      </div>

      <div className="card !p-4 !bg-primary-50 !border-primary-100">
        <div className="flex gap-2.5">
          <ListChecks className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
          <p className="text-xs text-ink-600 leading-relaxed">
            Chaque attribut défini ici apparaît automatiquement dans la fiche de tous les points de
            vente, sans redéploiement. Un attribut marqué <strong>obligatoire</strong> empêche un
            dossier de passer de « brouillon » à « complet » tant qu'il n'est pas renseigné.
          </p>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-24">Ordre</th>
                <th>Libellé</th>
                <th>Code</th>
                <th>Type</th>
                <th>Section</th>
                <th>Obligatoire</th>
                <th>État</th>
                <th className="text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-ink-400">
                    Chargement…
                  </td>
                </tr>
              ) : attributs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-ink-400">
                    Aucun attribut personnalisé. La fiche PDV n'affiche que les champs standards.
                  </td>
                </tr>
              ) : (
                attributs.map((attribut, index) => (
                  <tr key={attribut.id} className={attribut.actif ? '' : 'opacity-50'}>
                    <td>
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => deplacer(index, -1)}
                          disabled={index === 0}
                          className="btn-icon disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deplacer(index, 1)}
                          disabled={index === attributs.length - 1}
                          className="btn-icon disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="font-medium text-ink-900">{attribut.libelle}</div>
                      {attribut.aide ? (
                        <div className="text-xs text-ink-400">{attribut.aide}</div>
                      ) : null}
                    </td>
                    <td>
                      <code className="text-xs text-ink-500">{attribut.code}</code>
                    </td>
                    <td className="text-ink-600 text-sm">
                      {TYPE_LABELS[attribut.type]}
                      {attribut.options && attribut.options.length > 0 ? (
                        <div className="text-xs text-ink-400">
                          {attribut.options.length} option(s)
                        </div>
                      ) : null}
                    </td>
                    <td className="text-ink-600 text-sm">{attribut.groupe}</td>
                    <td>
                      <span className={attribut.obligatoire ? 'badge badge-warning' : 'badge badge-neutral'}>
                        {attribut.obligatoire ? 'Obligatoire' : 'Facultatif'}
                      </span>
                    </td>
                    <td>
                      <span className={attribut.actif ? 'badge badge-success' : 'badge badge-neutral'}>
                        {attribut.actif ? 'Affiché' : 'Masqué'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => basculerActif(attribut)}
                          className="btn-icon hover:text-primary-600 hover:bg-primary-50"
                          title={attribut.actif ? 'Masquer du formulaire' : 'Afficher dans le formulaire'}
                        >
                          {attribut.actif ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => ouvrirEdition(attribut)}
                          className="btn-icon hover:text-primary-600 hover:bg-primary-50"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(attribut)}
                          className="btn-icon hover:text-danger-600 hover:bg-danger-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl shadow-popover p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink-900">
                {editing ? "Modifier l'attribut" : 'Nouvel attribut'}
              </h2>
              <button onClick={fermer} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Libellé du champ *</label>
                <input
                  type="text"
                  className="input"
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  placeholder="Ex : Type de local"
                  required
                />
                {editing ? (
                  <p className="text-xs text-ink-400 mt-1">
                    Code technique : <code>{editing.code}</code> — non modifiable, c'est la clé à
                    laquelle les valeurs déjà saisies sont rattachées.
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Type de champ</label>
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as PdvAttributType })}
                  >
                    {(Object.keys(TYPE_LABELS) as PdvAttributType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Section du formulaire</label>
                  <input
                    type="text"
                    className="input"
                    value={form.groupe}
                    onChange={(e) => setForm({ ...form, groupe: e.target.value })}
                    placeholder="Informations complémentaires"
                  />
                </div>
              </div>

              {TYPES_AVEC_OPTIONS.includes(form.type) && (
                <div>
                  <label className="label">Options (une par ligne) *</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={form.optionsTexte}
                    onChange={(e) => setForm({ ...form, optionsTexte: e.target.value })}
                    placeholder={'Boutique\nKiosque\nÉtal\nContainer'}
                  />
                </div>
              )}

              <div>
                <label className="label">Texte d'aide (optionnel)</label>
                <input
                  type="text"
                  className="input"
                  value={form.aide}
                  onChange={(e) => setForm({ ...form, aide: e.target.value })}
                  placeholder="Affiché sous le champ pour guider l'agent"
                />
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.obligatoire}
                    onChange={(e) => setForm({ ...form, obligatoire: e.target.checked })}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-sm text-ink-700">
                    Obligatoire pour valider un dossier PDV
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.actif}
                    onChange={(e) => setForm({ ...form, actif: e.target.checked })}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-sm text-ink-700">Afficher dans le formulaire PDV</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={fermer} className="btn btn-secondary">
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdvAttributs;
