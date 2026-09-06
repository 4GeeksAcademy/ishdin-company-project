import Link from "next/link";

const AppHeader = () => {
  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">P&amp;T</span>
          <span>
            <strong>TrackFlow Talent Pipeline Tracker</strong>
            <small>People &amp; Talent recruitment workspace</small>
          </span>
        </Link>
        <span className="campaign-pill">TrackFlow Active recruitment campaign</span>
      </div>
    </header>
  );
};

export default AppHeader;
