'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  spendThisMonth: number;
  joinedAt: string;
}

interface TeamDetail {
  id: string;
  name: string;
  slug: string;
  currentUserRole: string;
  members: Member[];
  totalSpendThisMonth: number;
  spendByProvider: Record<string, number>;
  createdAt: string;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit name state
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwnerOrAdmin = team?.currentUserRole === 'OWNER' || team?.currentUserRole === 'ADMIN';
  const isOwner = team?.currentUserRole === 'OWNER';

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      } else if (res.status === 403 || res.status === 404) {
        setError('Team not found or access denied');
      }
    } catch {
      setError('Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  async function handleSaveName() {
    if (!editName.trim() || editName.trim() === team?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setEditingName(false);
        fetchTeam();
      }
    } catch {
      // handle error
    } finally {
      setSavingName(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail('');
        setInviteRole('MEMBER');
        setInviteSuccess('Member added successfully');
        fetchTeam();
        setTimeout(() => setInviteSuccess(''), 3000);
      } else {
        const data = await res.json();
        setInviteError(data.error || 'Failed to invite member');
      }
    } catch {
      setInviteError('Network error');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        fetchTeam();
      }
    } catch {
      // handle error
    }
  }

  async function handleDeleteTeam() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard/teams');
      }
    } catch {
      // handle error
    } finally {
      setDeleting(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const roleColors: Record<string, string> = {
    OWNER: 'text-amber-400 bg-amber-500/10',
    ADMIN: 'text-purple-400 bg-purple-500/10',
    MEMBER: 'text-blue-400 bg-blue-500/10',
    VIEWER: 'text-gray-400 bg-gray-500/10',
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-12 text-center">
        <h3 className="text-lg font-semibold text-white mb-2">{error || 'Team not found'}</h3>
        <Link href="/dashboard/teams" className="text-sm text-amber-400 hover:underline">
          Back to teams
        </Link>
      </div>
    );
  }

  // Compute spend chart bars
  const providerEntries = Object.entries(team.spendByProvider).sort(([, a], [, b]) => b - a);
  const maxProviderSpend = providerEntries.length > 0 ? Math.max(...providerEntries.map(([, v]) => v)) : 0;

  return (
    <div className="space-y-8">
      {/* Back link + Header */}
      <div>
        <Link href="/dashboard/teams" className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block">
          &larr; All Teams
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="px-3 py-1.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-lg text-white font-bold focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white">{team.name}</h1>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => { setEditName(team.name); setEditingName(true); }}
                    className="text-gray-600 hover:text-amber-400 transition-colors"
                    title="Edit team name"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-lg capitalize ${roleColors[team.currentUserRole] || ''}`}>
            {team.currentUserRole.toLowerCase()}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">/{team.slug}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Spend This Month</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(team.totalSpendThisMonth)}</p>
        </div>
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Members</p>
          <p className="text-2xl font-bold text-white">{team.members.length}</p>
        </div>
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Created</p>
          <p className="text-2xl font-bold text-white">{formatDate(team.createdAt)}</p>
        </div>
      </div>

      {/* Spend by Provider chart */}
      {providerEntries.length > 0 && (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Spend by Provider</h3>
          <div className="space-y-3">
            {providerEntries.map(([provider, spend]) => (
              <div key={provider}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300 capitalize">{provider.toLowerCase()}</span>
                  <span className="text-sm text-white font-medium">{formatCurrency(spend)}</span>
                </div>
                <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                    style={{ width: `${maxProviderSpend > 0 ? (spend / maxProviderSpend) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Members</h3>

        {/* Invite form (OWNER/ADMIN only) */}
        {isOwnerOrAdmin && (
          <div className="mb-6 p-4 rounded-xl border border-[#1a1a2a] bg-[#0a0a0f]">
            <p className="text-sm text-gray-400 mb-3">Invite a new member</p>
            {inviteError && (
              <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                {inviteSuccess}
              </div>
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 bg-[#12121a] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-4 py-2 bg-[#12121a] border border-[#1e1e2e] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  {isOwner && <option value="ADMIN">Admin</option>}
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {inviting ? 'Inviting...' : 'Add Member'}
              </button>
            </div>
          </div>
        )}

        {/* Members list */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">Name</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">Email</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">Role</th>
                <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">Spend</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">Joined</th>
                {isOwnerOrAdmin && (
                  <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {team.members.map((member) => (
                <tr key={member.id} className="border-b border-[#1a1a2a] last:border-0">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      {member.image ? (
                        <img src={member.image} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#1e1e2e] flex items-center justify-center text-xs text-gray-400">
                          {(member.name || member.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-white">{member.name || 'Unnamed'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-sm text-gray-400">{member.email}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`text-xs px-2 py-0.5 rounded-lg capitalize ${roleColors[member.role] || ''}`}>
                      {member.role.toLowerCase()}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-sm text-white">{formatCurrency(member.spendThisMonth)}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-sm text-gray-400">{formatDate(member.joinedAt)}</span>
                  </td>
                  {isOwnerOrAdmin && (
                    <td className="py-3 px-2 text-right">
                      {member.role !== 'OWNER' && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spend by Member chart */}
      {team.members.length > 0 && team.totalSpendThisMonth > 0 && (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Spend by Member</h3>
          <div className="space-y-3">
            {team.members
              .filter((m) => m.spendThisMonth > 0)
              .sort((a, b) => b.spendThisMonth - a.spendThisMonth)
              .map((member) => {
                const maxMemberSpend = Math.max(...team.members.map((m) => m.spendThisMonth));
                return (
                  <div key={member.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300">{member.name || member.email}</span>
                      <span className="text-sm text-white font-medium">{formatCurrency(member.spendThisMonth)}</span>
                    </div>
                    <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                        style={{ width: `${maxMemberSpend > 0 ? (member.spendThisMonth / maxMemberSpend) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Danger Zone (OWNER only) */}
      {isOwner && (
        <div className="bg-[#12121a] rounded-2xl border border-red-500/20 p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-4">
            Deleting this team will remove all members. This cannot be undone.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all"
            >
              Delete Team
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteTeam}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
