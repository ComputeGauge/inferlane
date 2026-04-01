'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Team {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
  totalSpendThisMonth: number;
  createdAt: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams);
      }
    } catch {
      // not authenticated or error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Auto-generate slug from name
  function handleNameChange(name: string) {
    setNewName(name);
    setNewSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 48)
    );
  }

  async function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim() }),
      });
      if (res.ok) {
        setNewName('');
        setNewSlug('');
        setShowCreate(false);
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create team');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Teams</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your teams, members, and track shared spend.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all"
        >
          {showCreate ? 'Cancel' : 'Create Team'}
        </button>
      </div>

      {/* Create Team Form */}
      {showCreate && (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create a New Team</h3>
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                Team Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Engineering"
                className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                Slug
              </label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="e.g. engineering"
                className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newSlug.trim()}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      )}

      {/* Teams List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No teams yet</h3>
          <p className="text-sm text-gray-500">
            Create a team to track shared spend and manage access.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/dashboard/teams/${team.id}`}
              className="block bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 hover:border-amber-500/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <span className="text-amber-400 font-bold text-sm">
                      {team.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-amber-400 transition-colors">
                      {team.name}
                    </h3>
                    <p className="text-xs text-gray-500">/{team.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Members</p>
                    <p className="text-sm font-medium text-white">{team.memberCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Spend this month</p>
                    <p className="text-sm font-medium text-white">
                      {formatCurrency(team.totalSpendThisMonth)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 capitalize">
                      {team.role.toLowerCase()}
                    </span>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-600 group-hover:text-amber-400 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
