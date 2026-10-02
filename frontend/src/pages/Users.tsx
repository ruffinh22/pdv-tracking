import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../components/DataTable';
import { Plus, Edit, Trash2, Mail, Phone, Search, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { userService, User, UserRole } from '../services/userService';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';

const ROLE_BADGE: Record<string, string> = {
  admin: 'badge badge-primary',
  superviseur: 'badge badge-dark',
  commercial: 'badge badge-neutral',
  chef_zone: 'badge badge-warning',
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  superviseur: 'Superviseur',
  commercial: 'Commercial',
  chef_zone: 'Chef de zone',
};

const UsersPage = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'superviseur' | 'commercial' | 'chef_zone'>('all');
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    mot_de_passe: '',
    // Le type de rôle est celui du service, pas une liste recopiée : sans ça,
    // éditer un compte "agence" ne compilait plus dès que ce rôle a été ajouté.
    role: 'commercial' as UserRole,
    telephone: '',
    matricule: '',
    statut: 'actif' as 'actif' | 'inactif'
  });

  const { data: usersResponse, isLoading } = useQuery({
    queryKey: ['users', currentPage, itemsPerPage],
    queryFn: () => userService.getAllUsers(currentPage, itemsPerPage),
    // Les données précédentes restent affichées pendant le rechargement :
    // changer de page ou de filtre ne doit pas vider la table puis la
    // reconstruire, ce qui donnait l'impression d'un rechargement complet.
    placeholderData: keepPreviousData,
  });

  const users: User[] = usersResponse?.data || [];
  const pagination = usersResponse?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const filteredUsers = useMemo(() => {
    return (users || []).filter((user) => {
      const fullName = `${user.prenom} ${user.nom}`.toLowerCase();
      const matchesSearch =
        fullName.includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      toast.success('Utilisateur créé avec succès');
      resetForm();
    },
    onError: () => {
      toast.error('Erreur lors de la création de l\'utilisateur');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => 
      userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      toast.success('Utilisateur mis à jour avec succès');
      resetForm();
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour de l\'utilisateur');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur supprimé avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression de l\'utilisateur');
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: 'actif' | 'inactif' }) =>
      userService.updateUserStatus(id, statut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Statut mis à jour avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du statut');
    }
  });

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { mot_de_passe, ...userData } = formData;
    
    if (editingUser) {
      // Only include password if it's provided
      const updateData = mot_de_passe ? { ...userData, mot_de_passe } : userData;
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      mot_de_passe: '',
      role: user.role,
      telephone: user.telephone || '',
      matricule: user.matricule || '',
      statut: user.statut
    });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleStatus = (user: User) => {
    const newStatus = user.statut === 'actif' ? 'inactif' : 'actif';
    statusMutation.mutate({ id: user.id, statut: newStatus });
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      email: '',
      mot_de_passe: '',
      role: 'commercial',
      telephone: '',
      matricule: '',
      statut: 'actif'
    });
    setEditingUser(null);
  };

  const initialsOf = (u: User) => `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase();

  const columns: ColumnDef<User>[] = [
    {
      id: 'utilisateur',
      header: 'Utilisateur',
      accessorFn: (u) => `${u.prenom} ${u.nom}`,
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center text-primary-800 text-[11px] font-extrabold shrink-0 ring-2 ring-white shadow-sm">
            {initialsOf(row.original)}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-ink-950">{row.original.prenom} {row.original.nom}</p>
            <p className="text-[11.5px] font-medium text-ink-500 truncate">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="space-y-1">
          {row.original.telephone && (
            <div className="flex items-center text-[12px] font-medium text-ink-700">
              <Phone className="w-3.5 h-3.5 mr-1.5 text-ink-400" />
              {row.original.telephone}
            </div>
          )}
          <div className="flex items-center text-[12px] font-medium text-ink-700">
            <Mail className="w-3.5 h-3.5 mr-1.5 text-ink-400" />
            {row.original.email}
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Rôle',
      accessorFn: (u) => ROLE_LABEL[u.role] ?? u.role,
      cell: ({ row }) => (
        <span className={ROLE_BADGE[row.original.role] ?? 'badge badge-neutral'}>
          {ROLE_LABEL[row.original.role] ?? row.original.role}
        </span>
      ),
    },
    {
      id: 'statut',
      header: 'Statut',
      accessorFn: (u) => u.statut,
      cell: ({ row }) => (
        <button onClick={() => handleToggleStatus(row.original)} className="flex items-center gap-1.5 text-sm" aria-label="Changer le statut">
          {row.original.statut === 'actif' ? (
            <>
              <ToggleRight className="w-6 h-6 text-success-600" />
              <span className="text-success-700 font-bold">Actif</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-6 h-6 text-ink-300" />
              <span className="text-ink-500 font-semibold">Inactif</span>
            </>
          )}
        </button>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: { align: 'right', mobileFooter: true },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => handleEdit(row.original)} className="btn-icon" aria-label="Modifier">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(row.original.id)} className="btn-icon hover:text-danger-600 hover:bg-danger-50" aria-label="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={'Utilisateurs'}
        subtitle={'Gérez les comptes et les rôles de votre équipe'}
        actions={<><button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Nouvel Utilisateur
        </button></>}
      />

      <div className="panel">
        <div className="toolbar">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="toolbar-select"
          >
            <option value="all">Tous les rôles</option>
            <option value="admin">Admin</option>
            <option value="superviseur">Superviseur</option>
            <option value="commercial">Commercial</option>
            <option value="chef_zone">Chef de zone</option>
          </select>
          <span className="ml-auto text-xs text-ink-400">
            {filteredUsers.length} résultat{filteredUsers.length > 1 ? 's' : ''}
          </span>
        </div>

        <DataTable
          data={filteredUsers}
          columns={columns}
          loading={isLoading}
          getRowId={(u) => String(u.id)}
          emptyMessage="Aucun utilisateur trouvé"
          emptyHint="Modifiez votre recherche ou créez un compte."
        />

        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          total={pagination.total}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl shadow-popover p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2>
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Prénom</label>
                    <input
                      type="text"
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Nom</label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">
                    Mot de passe {editingUser ? '(laisser vide pour conserver)' : ''}
                  </label>
                  <input
                    type="password"
                    value={formData.mot_de_passe}
                    onChange={(e) => setFormData({ ...formData, mot_de_passe: e.target.value })}
                    className="input"
                    required={!editingUser}
                  />
                </div>
                <div>
                  <label className="label">Téléphone</label>
                  <input
                    type="text"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Numéro matricule</label>
                  <input
                    type="text"
                    value={formData.matricule}
                    onChange={(e) =>
                      setFormData({ ...formData, matricule: e.target.value.toUpperCase() })
                    }
                    className="input"
                    placeholder="Ex : AG00412"
                  />
                  <p className="text-xs text-ink-400 mt-1">
                    C'est ce numéro que l'agent saisit sur l'application mobile pour enrôler un
                    point de vente. Sans matricule, le compte ne peut pas être utilisé sur le
                    terrain.
                  </p>
                </div>
                <div>
                  <label className="label">Rôle</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="input"
                  >
                    <option value="commercial">Commercial</option>
                    <option value="superviseur">Superviseur</option>
                    <option value="chef_zone">Chef de zone</option>
                    <option value="agence">Agence</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Statut</label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                    className="input"
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingUser ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;