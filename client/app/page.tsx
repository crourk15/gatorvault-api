import { redirect } from 'next/navigation';

/** Canonical landing page is /welcome — root redirects for SEO and nav consistency. */
export default function HomePage(): never {
  redirect('/welcome/');
}
