import React from 'react';
import { useNavigate } from 'react-router-dom';

const Breadcrumb = ({ items }) => {
  const navigate = useNavigate();

  return (
    <nav className="mb-6">
      <ol className="flex items-center space-x-2 text-sm">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && <li className="text-white/50">›</li>}
            <li>
              {item.href ? (
                <button
                  onClick={() => navigate(item.href)}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <span className="text-white/70 truncate max-w-xs">
                  {item.label}
                </span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;