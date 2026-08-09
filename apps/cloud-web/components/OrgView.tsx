'use client'

import { useState } from 'react'
import { createInvite, type MemberProfile, type Role } from '@/lib/api'
import { FieldLabel, Modal, ModalActions, textInputStyle } from '@/components/Modal'
import { ComingSoon } from '@/components/ComingSoon'
import { SectionHeader, Toast } from '@/components/AccountView'
import { initials } from '@/lib/initials'

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  boxShadow: 'var(--shadow)',
}

export function OrgView({ profile }: { profile: MemberProfile }) {
  const { org } = profile
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('MEMBER')
  const [toast, setToast] = useState<string | null>(null)

  function showToast(t: string) {
    setToast(t)
    setTimeout(() => setToast(null), 2600)
  }

  async function submitInvite() {
    if (!email) return
    await createInvite(email, role)
    showToast(`Invite sent to ${email}`)
    setInviteOpen(false)
    setEmail('')
    setRole('MEMBER')
  }

  return (
    <div
      style={{ maxWidth: 800, margin: '0 auto', padding: '30px 28px 100px' }}
      className="fade-in"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>
            Organization
          </h1>
          <p style={{ color: 'var(--muted)', margin: '8px 0 0', fontSize: 14 }}>
            Members, teams and invitations for {org.name}.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="hover-btn"
          style={{
            flex: 'none',
            background: 'var(--accent-grad)',
            color: '#fff',
            border: 'none',
            borderRadius: 9,
            padding: '9px 15px',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 6px 15px -8px rgba(236,48,19,.6)',
          }}
        >
          + Invite member
        </button>
      </div>

      <div style={{ ...card, padding: '19px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 13,
              background: 'var(--av-grad)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              fontWeight: 800,
              flex: 'none',
            }}
          >
            {initials(org.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>{org.name}</div>
            <div
              style={{
                fontSize: '12.5px',
                color: 'var(--faint)',
                marginTop: 4,
                fontFamily: 'var(--mono)',
              }}
            >
              openoffice.ai/{org.slug}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 30 }}>
        <SectionHeader title="Members" subtitle="Everyone with access to this org." />
        <ComingSoon
          title="Member management isn't wired up yet"
          detail="Listing, editing, and removing org members needs a cloud-api endpoint that doesn't exist yet."
        />
      </div>

      <div style={{ marginTop: 30 }}>
        <SectionHeader title="Teams" subtitle="Optional groupings of members." />
        <ComingSoon
          title="Team management isn't wired up yet"
          detail="The Team model exists, but cloud-api has no endpoint to list or create teams yet."
        />
      </div>

      <div style={{ marginTop: 30 }}>
        <SectionHeader title="Pending invites" subtitle="Invitations sent but not yet accepted." />
        <ComingSoon
          title="Invite tracking isn't wired up yet"
          detail="Sending invites works (above) — listing, resending, and revoking them needs an endpoint that doesn't exist yet."
        />
      </div>

      {inviteOpen && (
        <Modal title="Invite member" onClose={() => setInviteOpen(false)}>
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <input
            id="invite-email"
            name="invite-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            style={{ ...textInputStyle, marginBottom: 14 }}
          />
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <select
            id="invite-role"
            name="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={{ ...textInputStyle, cursor: 'pointer' }}
          >
            <option value="ADMIN">Admin</option>
            <option value="TEAM_LEADER">Team Leader</option>
            <option value="MEMBER">Member</option>
          </select>
          <ModalActions
            onCancel={() => setInviteOpen(false)}
            cta="Send invite"
            onSubmit={submitInvite}
          />
        </Modal>
      )}

      {toast && <Toast text={toast} />}
    </div>
  )
}
