import { useEffect } from 'react';

/**
 * Copie le texte de chaque <th> dans l'attribut data-label des <td> de sa
 * colonne. Le CSS mobile (index.css) s'en sert pour afficher chaque ligne de
 * tableau comme une carte « LIBELLÉ : valeur » — zéro défilement horizontal,
 * sans réécrire les ~16 tableaux de l'application.
 * (Écoute les changements du DOM : les tableaux filtrés/rechargés restent étiquetés.)
 */
function labelTables(root: ParentNode) {
  root.querySelectorAll('table').forEach((table) => {
    const heads = Array.from(table.querySelectorAll('thead tr:last-child th')).map((th) => th.textContent?.trim() ?? '');
    if (heads.length === 0) return;
    table.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
      let col = 0;
      Array.from(tr.children).forEach((cell) => {
        const label = heads[col] ?? '';
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
        col += (cell as HTMLTableCellElement).colSpan || 1;
      });
    });
  });
}

export function useTableLabels() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => labelTables(document));
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
}
