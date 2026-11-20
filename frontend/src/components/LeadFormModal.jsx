import { useState } from 'react';
import Modal from './Modal';
import Field from './Field';
import { SOURCES, STATUSES } from '../utils/constants';
import { validateLead } from '../utils/validation';

const EMPTY = { name: '', email: '', phone: '', company: '', source: '', status: 'New' };

export default function LeadFormModal({ lead, onSubmit, onClose }) {
  const isEdit = Boolean(lead);
  const [values, setValues] = useState(() => (lead ? {
    name: lead.name, email: lead.email, phone: lead.phone,
    company: lead.company, source: lead.source, status: lead.status,
  } : EMPTY));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const found = validateLead(values);
    if (Object.keys(found).length) { setErrors(found); return; }

    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      // Surface server-side field errors inline, anything else as a banner
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      setFormError(err.details ? 'Please fix the highlighted fields.' : err.message);
      setSaving(false);
    }
  };

  const input = (key, label, props = {}) => (
    <Field label={label} id={`lead-${key}`} error={errors[key]}>
      <input id={`lead-${key}`} value={values[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} {...props} />
    </Field>
  );

  return (
    <Modal title={isEdit ? 'Edit lead' : 'Add new lead'} onClose={onClose} busy={saving}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}
          <div className="form-grid">
            {input('name', 'Full name', { placeholder: 'Jane Doe', autoComplete: 'off' })}
            {input('company', 'Company', { placeholder: 'Acme Inc', autoComplete: 'off' })}
            {input('email', 'Email', { type: 'email', placeholder: 'jane@acme.com', autoComplete: 'off' })}
            {input('phone', 'Phone', { type: 'tel', placeholder: '+91 98765 43210', autoComplete: 'off' })}
            <Field label="Source" id="lead-source" error={errors.source}>
              <select id="lead-source" value={values.source} onChange={set('source')} aria-invalid={Boolean(errors.source)}>
                <option value="">Select source…</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Status" id="lead-status" error={errors.status}>
              <select id="lead-status" value={values.status} onChange={set('status')}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
