import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return <section className="section-wrap empty-state not-found"><p className="eyebrow">404</p><h1>That page wandered off.</h1><p>Let’s get you back to the good stuff.</p><Link className="button" to="/">Go to restaurants</Link></section>;
}
