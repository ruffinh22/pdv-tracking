import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Mail, Phone, Shield, User as UserIcon, ToggleLeft, ToggleRight } from 'lucide-react';
import { userService, User } from '../services/userService';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';

const UsersPage = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    mot_de_passe: '',
    role: 'commercial' as 'admin' | 'superviseur' | 'commercial',
    telephone: '',
    statut: 'actif' as 'actif' | 'inactif'
  });

  const { data: usersResponse, isLoading } = useQuery({
    queryKey: ['users', currentPage, itemsPerPage],
    queryFn: () => userService.getAllUsers(currentPage, itemsPerPage)
  });

  const users = usersResponse?.data || [];
  const pagination = usersResponse?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

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
      statut: 'actif'
    });
    setEditingUser(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Utilisateurs</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvel Utilisateur
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Utilisateur</th>
                <th className="text-left p-4">Contact</th>
                <th className="text-left p-4">Rôle</th>
                <th className="text-left p-4">Statut</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                        <UserIcon className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium">{user.prenom} {user.nom}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      {user.telephone && (
                        <div className="flex items-center text-sm">
                          <Phone className="w-4 h-4 mr-2 text-gray-500" />
                          {user.telephone}
                        </div>
                      )}
                      <div className="flex items-center text-sm">
                        <Mail className="w-4 h-4 mr-2 text-gray-500" />
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-gray-500" />
                      <span className={`px-2 py-1 text-xs rounded ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'superviseur' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className="flex items-center space-x-2 text-sm"
                    >
                      {user.statut === 'actif' ? (
                        <>
                          <ToggleRight className="w-5 h-5 text-success-600" />
                          <span className="text-success-600">Actif</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-400">Inactif</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Prénom</label>
                    <input
                      type="text"
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom</label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Mot de passe {editingUser ? '(laisser vide pour conserver)' : ''}
                  </label>
                  <input
                    type="password"
                    value={formData.mot_de_passe}
                    onChange={(e) => setFormData({ ...formData, mot_de_passe: e.target.value })}
                    className="w-full p-2 border rounded"
                    required={!editingUser}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rôle</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="commercial">Commercial</option>
                    <option value="superviseur">Superviseur</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Statut</label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
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
