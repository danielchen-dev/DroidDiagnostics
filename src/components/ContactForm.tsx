import { useState } from 'react';
import { getVisitorId, track } from '@/lib/analytics';

export default function ContactForm({ turnstileSiteKey = '' }: { turnstileSiteKey?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('sending');
    setMessage('');
    void track('contact_started');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      email: String(form.get('email') ?? ''),
      company: String(form.get('company') ?? ''),
      issueType: String(form.get('issueType') ?? ''),
      message: String(form.get('message') ?? ''),
      sourcePage: window.location.pathname,
      visitorId: getVisitorId(),
      turnstileToken: String(form.get('cf-turnstile-response') ?? ''),
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Could not submit the request.');
      setState('sent');
      setMessage('Your request was received. Keep the original diagnostic archive available for follow-up analysis.');
      formElement.reset();
      void track('contact_submitted');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Could not submit the request.');
    }
  };

  return (
    <form className="contact-form card card-pad" onSubmit={submit}>
      <div className="form-row">
        <label>Email<input type="email" name="email" required maxLength={200} /></label>
        <label>Company <span className="optional">optional</span><input type="text" name="company" maxLength={160} /></label>
      </div>
      <label>Issue type
        <select name="issueType" required defaultValue="">
          <option value="" disabled>Select an issue</option>
          <option>Unexpected Reboot</option>
          <option>ANR / Freeze</option>
          <option>App or System Crash</option>
          <option>Kernel / Driver</option>
          <option>Fingerprint / Biometric</option>
          <option>Display / SurfaceFlinger</option>
          <option>AOSP / BSP</option>
          <option>Other</option>
        </select>
      </label>
      <label>What happened?
        <textarea name="message" required minLength={20} maxLength={4000} rows={8} placeholder="Describe the symptom, device/build, approximate incident time, and what you have already checked." />
      </label>
      {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey}></div>}
      <button className="button button-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Request engineering review'}</button>
      {message && <p className={state === 'error' ? 'form-error' : 'form-success'}>{message}</p>}
      <p className="form-note">Do not submit private bugreport content in this form. The automated analyzer keeps diagnostic files inside your browser.</p>
    </form>
  );
}
