import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [plan, setPlan] = useState('Free');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [role, setRole] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) return router.push('/');
    fetchNotes(token);
    fetchPlan(token);
    // Decode role and tenant from JWT
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setRole(payload.role);
    } catch {}
  }, []);

  async function fetchPlan(token) {
    // Use a backend call to infer plan status
    // We'll use the /notes endpoint and check the tenant's plan from the backend (by adding a custom endpoint or using the notes array)
    // For now, try to create a dummy note to see if plan is Pro or Free
    // Instead, let's add a /tenants/:slug/plan endpoint in the backend for accuracy
    let tenantId = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenantId;
    } catch {}
    if (!tenantId) return;
    try {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${base}/api/tenants/${tenantId}/plan`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
      }
    } catch {}
  }

  async function fetchNotes(token) {
    setError('');
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${base}/api/notes`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (res.status === 401) return router.push('/');
    const data = await res.json();
    setNotes(data);
    // Fetch plan from first note's tenant if present
    if (data.length > 0) {
      const note = data[0];
      // Not ideal, but backend doesn't expose plan directly
      // We'll fetch plan after failed create
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    const token = getToken();
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${base}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ title, content })
    });
    if (res.status === 201) {
      setTitle(''); setContent('');
      fetchNotes(token);
      setShowUpgrade(false);
    } else if (res.status === 402) {
      setShowUpgrade(true);
      setError('Free plan limit reached. Upgrade to Pro to add more notes.');
    } else {
      const data = await res.json();
      setError(data.error || 'Error creating note');
    }
  }

  async function handleDelete(id) {
    const token = getToken();
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  await fetch(`${base}/api/notes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    fetchNotes(token);
  }


  async function handleUpgrade() {
    setError('');
    const token = getToken();
    let tenantId = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenantId;
    } catch {}
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${base}/api/tenants/${tenantId}/upgrade`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
    if (res.ok) {
      setShowUpgrade(false);
      fetchPlan(token);
      setError('Upgraded to Pro! You can now add unlimited notes.');
    } else {
      setError('Upgrade failed. Only Admins can upgrade.');
    }
  }

  async function handleDowngrade() {
    setError('');
    const token = getToken();
    let tenantId = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenantId;
    } catch {}
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${base}/api/tenants/${tenantId}/downgrade`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
    if (res.ok) {
      fetchPlan(token);
      setError('Downgraded to Free. Note limit is now 3.');
    } else {
      setError('Downgrade failed. Only Admins can downgrade.');
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    router.push('/');
  }

  return (
    <div className="container">
      <div className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1><span className="logo">📝</span> Notes</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="user-role" style={{ fontWeight: 500, color: '#555', fontSize: '1rem' }}>{role ? (role === 'Admin' ? 'Admin' : 'Member') : ''}</span>
          <button className="logout" onClick={handleLogout} title="Logout">Logout</button>
        </div>
      </div>
      <form onSubmit={handleCreate} className="note-form">
        <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required maxLength={60} />
        <textarea placeholder="Content" value={content} onChange={e => setContent(e.target.value)} maxLength={500} />
        <button type="submit">Add Note</button>
      </form>
      {showUpgrade && (
        <div className="upgrade">
          <p>Free plan limit reached.</p>
          {role === 'Admin' ? (
            <button onClick={handleUpgrade}>Upgrade to Pro</button>
          ) : (
            <span>Ask your Admin to upgrade.</span>
          )}
        </div>
      )}
      {/* Show plan status and downgrade option for Admins */}
      {role === 'Admin' && (
        <div className="plan-status">
          <span className="plan-label">Current Plan:</span> <span className={plan === 'Pro' ? 'pro' : 'free'}>{plan}</span>
          {plan === 'Pro' && (
            <button className="downgrade" onClick={handleDowngrade}>Revoke Pro (Downgrade)</button>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="notes-list">
        {notes.length === 0 ? (
          <li className="empty">No notes yet. <span className="hint">Create your first note!</span></li>
        ) : notes.map(note => (
          <li key={note.id} className="note">
            <div className="note-content">
              <strong className="note-title">{note.title}</strong>
              {note.content && <p className="note-body">{note.content}</p>}
            </div>
            <button onClick={() => handleDelete(note.id)} title="Delete note" className="delete">🗑️</button>
          </li>
        ))}
      </ul>
      <style jsx>{`
        .container {
          max-width: 600px;
          margin: 40px auto;
          padding: 2.5rem 2rem;
          border-radius: 16px;
          box-shadow: 0 8px 32px #0002;
          background: #fff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .logo {
          font-size: 1.6rem;
          margin-right: 0.5rem;
        }
        h1 {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          color: #333;
          display: flex;
          align-items: center;
        }
        .logout {
          background: linear-gradient(90deg, #fc5c7d 0%, #6a82fb 100%);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0.6rem 1.1rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .logout:hover {
          background: #e53935;
        }
        .note-form {
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          margin: 1rem 0 2rem 0;
        }
        .note-form input, .note-form textarea {
          padding: 0.9rem 1rem;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background: #fafbfc;
          font-size: 1rem;
        }
        .note-form textarea {
          resize: vertical;
          min-height: 40px;
          max-height: 120px;
        }
        .note-form button {
          padding: 0.9rem 1.2rem;
          background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
          color: #fff;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .note-form button:hover {
          background: #6a82fb;
        }
        .upgrade {
          background: #fffae6;
          border: 1px solid #ffe58f;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          text-align: center;
        }
        .upgrade button {
          background: #ffb300;
          color: #fff;
          margin-top: 0.5rem;
          border-radius: 6px;
          border: none;
          padding: 0.7rem 1.2rem;
          font-weight: 600;
          cursor: pointer;
        }
        .upgrade button:hover {
          background: #ff9800;
        }
        .notes-list {
          list-style: none;
          padding: 0;
          margin-top: 2rem;
        }
        .note {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: #f9f9f9;
          margin-bottom: 1.2rem;
          padding: 1.2rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px #0001;
          transition: box-shadow 0.2s;
        }
        .note:hover {
          box-shadow: 0 4px 16px #0002;
        }
        .note-content {
          flex: 1;
        }
        .note-title {
          font-size: 1.1rem;
          color: #222;
        }
        .note-body {
          margin: 0.5rem 0 0 0;
          color: #555;
        }
        .delete {
          background: none;
          color: #e00;
          border: none;
          border-radius: 4px;
          padding: 0.4rem 0.8rem;
          font-size: 1.2rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .delete:hover {
          background: #ffeaea;
        }
        .empty {
          text-align: center;
          color: #888;
          font-size: 1.1rem;
          padding: 2rem 0;
        }
        .hint {
          color: #6a82fb;
          font-weight: 500;
        }
        .error {
          color: #c00;
          text-align: center;
          margin-top: 1rem;
        }
        .plan-status {
          margin: 1.5rem 0 0.5rem 0;
          text-align: center;
          font-size: 1.08rem;
        }
        .plan-label {
          color: #888;
          font-weight: 500;
        }
        .pro {
          color: #43a047;
          font-weight: 600;
        }
        .free {
          color: #e53935;
          font-weight: 600;
        }
        .downgrade {
          margin-left: 1.2rem;
          background: #e53935;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 1.1rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .downgrade:hover {
          background: #b71c1c;
        }
        @media (max-width: 700px) {
          .container {
            max-width: 98vw;
            padding: 1.2rem 0.5rem;
          }
          .header h1 {
            font-size: 1.3rem;
          }
          .note-form input, .note-form textarea {
            font-size: 0.98rem;
          }
          .note-form button {
            font-size: 1rem;
          }
          .note {
            flex-direction: column;
            gap: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}
