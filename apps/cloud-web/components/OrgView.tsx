'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteSchema, useInvite, type InviteForm, type MemberProfile, initials } from '@/lib';
import { FieldLabel, Modal, ModalActions, textInputStyle } from './Modal';
import { ComingSoon } from './ComingSoon';
import { useToast } from './ToastProvider';

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  boxShadow: 'var(--shadow)',
};

export function OrgView({ profile }: { profile: MemberProfile }) {
  const { org } = profile;
  const [inviteOpen, setInviteOpen] = useState(false);
  const showToast = useToast();
  const inviteMutation = useInvite();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });

  const submitInvite = handleSubmit((data) => {
    inviteMutation.mutate(data, {
      onSuccess: () => {
        showToast(`Invite sent to ${data.email}`);
        setInviteOpen(false);
        reset();
      },
      onError: () => setError('root', { type: 'manual', message: 'Failed to send invite.' }),
    });
  });

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
            Members, teams, roles and invitations for {org.name}.
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

      <section id="sec-org" style={{ scrollMarginTop: 14 }}>
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>
                  {org.name}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: '.02em',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    borderRadius: 6,
                    padding: '2px 7px',
                  }}
                >
                  Free plan
                </span>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--faint)',
                  marginTop: 4,
                  fontFamily: 'var(--mono)',
                }}
              >
                openoffice.ai/{org.slug}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, flex: 'none' }}>
              <OrgStat value="—" label="Members" />
              <OrgStat value="—" label="Teams" />
              <OrgStat value="—" label="Pending" />
            </div>
          </div>
        </div>
      </section>

      <section id="sec-members" style={{ scrollMarginTop: 14, marginTop: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>Members</span>
        </div>
        <ComingSoon
          title="Member listing isn't wired up yet"
          detail="Listing, editing, and removing org members needs a cloud-api endpoint that doesn't exist yet."
        />
      </section>

      <section id="sec-teams" style={{ scrollMarginTop: 14, marginTop: 30 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>Teams</span>
          </div>
          <button
            onClick={() => showToast('Team creation — coming soon')}
            className="hover-ghost"
            style={{
              flex: 'none',
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border-2)',
              borderRadius: 9,
              padding: '8px 13px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Create team
          </button>
        </div>
        <ComingSoon
          title="Team management isn't wired up yet"
          detail="The Team model exists, but cloud-api has no endpoint to list or create teams yet."
        />
      </section>

      <section id="sec-invites" style={{ scrollMarginTop: 14, marginTop: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>
            Pending invites
          </span>
        </div>
        <ComingSoon
          title="Invite tracking isn't wired up yet"
          detail="Sending invites works (above) — listing, resending, and revoking them needs an endpoint that doesn't exist yet."
        />
      </section>

      {inviteOpen && (
        <Modal title="Invite member" onClose={() => setInviteOpen(false)}>
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <input
            id="invite-email"
            type="email"
            autoComplete="off"
            placeholder="teammate@company.com"
            {...register('email')}
            style={{ ...textInputStyle, marginBottom: errors.email ? 4 : 14 }}
          />
          {errors.email && (
            <div style={{ color: '#ef4444', fontSize: 12.5, marginBottom: 14, marginTop: 2 }}>
              {errors.email.message}
            </div>
          )}
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <select
            id="invite-role"
            aria-label="Role"
            {...register('role')}
            style={{ ...textInputStyle, cursor: 'pointer' }}
          >
            <option value="ADMIN">Admin</option>
            <option value="TEAM_LEADER">Team Leader</option>
            <option value="MEMBER">Member</option>
          </select>
          {errors.root && (
            <div style={{ color: '#ef4444', fontSize: 12.5, marginTop: 12 }}>
              {errors.root.message}
            </div>
          )}
          <ModalActions
            onCancel={() => setInviteOpen(false)}
            cta="Send invite"
            onSubmit={submitInvite}
            disabled={inviteMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

function OrgStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--faint)',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          fontWeight: 600,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
