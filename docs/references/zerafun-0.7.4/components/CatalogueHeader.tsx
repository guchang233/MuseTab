import type { ReactNode } from 'react';

/** A stable title/search grid shared by the browse pages. */
export default function CatalogueHeader({ title, actions, search }: { title: ReactNode; actions?: ReactNode; search?: ReactNode }) {
  return <header className="browse-header">
    <div className="browse-heading"><h1>{title}</h1>{actions && <div className="browse-actions">{actions}</div>}</div>
    <div className="browse-search">{search}</div>
  </header>;
}
