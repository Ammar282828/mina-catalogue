import React, { useEffect, useMemo, useState } from 'react';
import { useUser, signIn, signOut } from '../lib/auth.js';
import { useAccount, saveAccount } from '../lib/account.js';
import { useFavourites } from '../lib/store.js';
import { enquireList } from '../lib/contact.js';
import { Headline, PieceGrid, Link, WhatsAppIcon, ArrowRight } from './ui.jsx';
import { PickedForYou } from './Recs.jsx';

/**
 * A customer's account (the owner, 2026-09-25: "add accounts … like taheri.shop"). Signed out,
 * a card that says what it is for and one big button. Signed in: their saved pieces (kept on
 * every device they sign in on), their details, and pieces picked for them. Never a wall —
 * looking and asking never need it.
 */
const field = 'mt-1.5 block w-full border border-line bg-bg px-3.5 py-3 text-[16px] text-ink focus:border-accent focus:outline-none';
const label = 'label-lg text-ink-2';

export default function Account({ cat }) {
  const user = useUser();
  const account = useAccount();
  const fav = useFavourites();
  const saved = useMemo(() => fav.list.map((h) => cat.byHandle.get(h)).filter(Boolean), [fav.list, cat]);
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ busy: false, saved: false, error: null });
  const [signInError, setSignInError] = useState('');

  // Fill the form once from the record, then let the person edit.
  useEffect(() => { if (account && !form) setForm({ ...account.profile }); }, [account, form]);
  useEffect(() => { if (!user) setForm(null); }, [user]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setState((s) => ({ ...s, saved: false })); };
  const save = async (e) => {
    e.preventDefault();
    setState({ busy: true, saved: false, error: null });
    try { await saveAccount({ profile: form }); setState({ busy: false, saved: true, error: null }); }
    catch (err) { setState({ busy: false, saved: false, error: err.message }); }
  };
  const start = () => { setSignInError(''); signIn().catch(() => setSignInError('Signing in did not work just now. Please try again, or ask us on WhatsApp.')); };

  return (
    <div className="px-5 sm:px-8 md:px-12 pt-28 md:pt-32 pb-24">
      <div className="mx-auto max-w-[1280px]">
        {user === undefined ? (
          <p className="text-[15px] text-ink-2">Opening your account…</p>
        ) : !user ? (
          <div className="max-w-[40rem]">
            <p className="eyebrow text-accent">Your account</p>
            <Headline className="mt-3">Keep your saved pieces with you</Headline>
            <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
              Sign in with your Google account and the pieces you save with the heart follow you to your phone, your tablet and your computer.
              You never need an account to look at the jewellery or to ask us about it.
            </p>
            <button type="button" onClick={start} className="press btn-big mt-9 bg-accent text-on-accent">
              <GoogleMark /> Sign in with Google
            </button>
            {signInError && <p className="mt-4 text-[15px] text-accent">{signInError}</p>}
            <p className="mt-6 text-[14px] text-ink-2">A small Google window opens; choose your account there and you are back here, signed in.</p>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow text-accent">Your account</p>
                <Headline className="mt-3">Hello, {(account?.profile?.name || user.name || user.email).split(' ')[0]}</Headline>
                <p className="mt-3 text-[15px] text-ink-2">{user.email}</p>
              </div>
              <button type="button" onClick={() => signOut()} className="press label-lg border border-line px-5 py-3 text-ink hover:border-accent hover:text-accent">Sign out</button>
            </header>

            <section className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="display text-[clamp(1.8rem,3.6vw,2.6rem)] leading-none">Your saved pieces<span className="text-rose not-italic">.</span></h2>
                  <p className="mt-3 text-[15px] text-ink-2">
                    {saved.length ? `${saved.length} ${saved.length === 1 ? 'piece' : 'pieces'}, kept on every device you sign in on.` : 'None yet. Tap the heart on any piece and it is kept here, on every device you sign in on.'}
                  </p>
                </div>
                {saved.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    <a href={enquireList(saved)} target="_blank" rel="noopener" className="press btn-big bg-accent text-on-accent">
                      <WhatsAppIcon className="w-5 h-5" /> Send them on WhatsApp
                    </a>
                    <Link to="/favourites" className="press btn-big border border-line text-ink hover:border-accent hover:text-accent">See all <ArrowRight className="w-4 h-4" /></Link>
                  </div>
                )}
              </div>
              {saved.length > 0 && <div className="mt-8"><PieceGrid pieces={saved.slice(0, 8)} isNew={cat.isNew} eagerCount={0} /></div>}
              {!saved.length && <Link to="/collections" className="press btn-big mt-6 bg-accent text-on-accent">See the jewellery <ArrowRight className="w-4 h-4" /></Link>}
            </section>

            <section className="mt-20 max-w-[40rem]">
              <h2 className="display text-[clamp(1.8rem,3.6vw,2.6rem)] leading-none">Your details<span className="text-rose not-italic">.</span></h2>
              <p className="mt-3 text-[15px] text-ink-2">So we know who you are when you message us, and where to send a piece.</p>
              {form ? (
                <form onSubmit={save} className="mt-8 grid gap-6 sm:grid-cols-2">
                  <label className="sm:col-span-2 block"><span className={label}>Name</span><input className={field} value={form.name || ''} onChange={set('name')} autoComplete="name" /></label>
                  <label className="block"><span className={label}>WhatsApp number</span><input className={field} inputMode="tel" placeholder="03xx xxxxxxx" value={form.phone || ''} onChange={set('phone')} autoComplete="tel" /></label>
                  <label className="block"><span className={label}>City</span><input className={field} value={form.city || ''} onChange={set('city')} autoComplete="address-level2" /></label>
                  <label className="sm:col-span-2 block"><span className={label}>Address</span><input className={field} value={form.address || ''} onChange={set('address')} autoComplete="street-address" /></label>
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
                    <button type="submit" disabled={state.busy} className="press btn-big bg-accent text-on-accent disabled:opacity-60">{state.busy ? 'Saving…' : 'Save my details'}</button>
                    {state.saved && <span className="text-[15px] text-ink-2">Saved.</span>}
                    {state.error && <span className="text-[15px] text-accent">{state.error}</span>}
                  </div>
                </form>
              ) : <p className="mt-6 text-[15px] text-ink-2">Loading…</p>}
            </section>

            <PickedForYou cat={cat} className="mt-24" />
          </>
        )}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path fill="currentColor" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.3 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
