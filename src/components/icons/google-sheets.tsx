import type { SVGProps } from "react";

const GoogleSheets = (props: SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#43a047"
      d="M37 45H11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h17l11 11v29a2 2 0 0 1-2 2z"
    />
    <path fill="#c8e6c9" d="M40 14H28V2z" />
    <path fill="#2e7d32" d="M28 14l12 12V14z" />
    <path fill="#fff" d="M15 24h18v2H15zm0 4h18v2H15zm0 4h12v2H15zm0-12h18v2H15z" />
  </svg>
);

export { GoogleSheets };
