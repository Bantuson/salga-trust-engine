import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { CustomSelect } from '../CustomSelect';
import { supabase } from '../../lib/supabase';

const PILOT_MUNICIPALITIES = [
  'City of Johannesburg',
  'City of Tshwane',
  'City of Cape Town',
  'eThekwini Municipality',
  'Ekurhuleni Metropolitan Municipality',
];

export function PersonalDetails() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [municipality, setMunicipality] = useState('');

  // Read-only fields
  const email = user?.email || '';
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '';

  // Load initial values from user metadata
  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setPhone(user.phone || user.user_metadata?.phone || '');
      setAddress(user.user_metadata?.address || '');
      setMunicipality(user.user_metadata?.municipality || '');
    }
  }, [user]);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const handleEdit = () => {
    setIsEditing(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleCancel = () => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setPhone(user.phone || user.user_metadata?.phone || '');
      setAddress(user.user_metadata?.address || '');
      setMunicipality(user.user_metadata?.municipality || '');
    }
    setIsEditing(false);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone: phone,
          address: address,
          municipality: municipality,
        },
      });

      if (error) throw error;

      setSuccessMessage('Profile updated successfully');
      setIsEditing(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-primary)' }}>Loading...</p>
      </div>
    );
  }

  const inputStyle = (editable: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '2px solid var(--border-subtle)',
    background: editable && isEditing ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
    color: 'rgba(80, 80, 80, 0.85)',
    fontSize: '1rem',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    transition: 'all 0.3s ease',
    cursor: editable && isEditing ? 'text' : 'not-allowed',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    color: 'var(--text-primary)',
    fontWeight: 500,
    fontSize: '0.9rem',
  };

  return (
    <div>
      {/* Success/Error messages */}
      {successMessage && (
        <div style={{
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          background: 'rgba(130, 211, 192, 0.1)',
          border: '2px solid var(--color-teal)',
          color: 'var(--text-primary)',
        }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          background: 'rgba(205, 94, 129, 0.1)',
          border: '2px solid var(--color-coral)',
          color: 'var(--text-primary)',
        }}>
          {errorMessage}
        </div>
      )}

      {/* Personal Information */}
      <GlassCard className="personal-details-card" style={{ marginBottom: '2rem' }}>
        {!isEditing && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <Button variant="secondary" size="sm" onClick={handleEdit} style={{ background: 'var(--color-coral)', color: '#fff', border: 'none', width: '100%' }}>
              Edit Profile
            </Button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Full Name */}
          <div>
            <label htmlFor="pd-fullName" style={labelStyle}>Full Name</label>
            <input
              id="pd-fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={!isEditing}
              style={inputStyle(true)}
            />
          </div>

          {/* Email (readonly) */}
          <div>
            <label htmlFor="pd-email" style={labelStyle}>Email</label>
            <input id="pd-email" type="email" value={email} disabled style={inputStyle(false)} />
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Email cannot be changed (authentication identifier)
            </p>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="pd-phone" style={labelStyle}>Phone Number</label>
            <input
              id="pd-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!isEditing}
              placeholder="+27XXXXXXXXX"
              style={inputStyle(true)}
            />
          </div>

          {/* Street Address */}
          <div>
            <label htmlFor="pd-address" style={labelStyle}>Street Address</label>
            <input
              id="pd-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!isEditing}
              placeholder="e.g. 42 Vilakazi St, Soweto"
              style={inputStyle(true)}
            />
          </div>

          {/* Municipality */}
          <div>
            <label htmlFor="pd-municipality" style={labelStyle}>Municipality</label>
            {isEditing ? (
              <div style={{ width: '100%' }}>
                <CustomSelect
                  options={PILOT_MUNICIPALITIES.map(m => ({ value: m, label: m }))}
                  value={municipality}
                  onChange={setMunicipality}
                  placeholder="Select your municipality (optional)"
                />
              </div>
            ) : (
              <input
                id="pd-municipality"
                type="text"
                value={municipality || 'Not selected'}
                disabled
                style={inputStyle(false)}
              />
            )}
          </div>

          {/* Account Created (readonly) */}
          <div>
            <label htmlFor="pd-createdAt" style={labelStyle}>Account Created</label>
            <input id="pd-createdAt" type="text" value={createdAt} disabled style={inputStyle(false)} />
          </div>
        </div>

        {/* Edit mode buttons */}
        {isEditing && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={isSaving} style={{ background: '#10b981', whiteSpace: 'nowrap' }}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
