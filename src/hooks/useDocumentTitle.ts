import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | OfficeLume` : 'OfficeLume | Less admin. More service.';
    return () => {
      document.title = previous;
    };
  }, [title]);
}
