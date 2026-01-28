import { Link } from 'react-router-dom';
import './Breadcrumbs.css';

/**
 * Breadcrumbs navigation component
 * @param {Object} props
 * @param {Array<{label: string, href?: string}>} props.items - Array of breadcrumb items
 */
export function Breadcrumbs({ items = [] }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="breadcrumbs__item">
              {!isLast && item.href ? (
                <>
                  <Link to={item.href} className="breadcrumbs__link">
                    {item.label}
                  </Link>
                  <span className="breadcrumbs__separator" aria-hidden="true">/</span>
                </>
              ) : (
                <span className="breadcrumbs__current" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
