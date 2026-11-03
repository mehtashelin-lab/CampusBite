import { Link } from "react-router-dom";

export default function DeliveryPage() {
  return <section className="section-wrap coming-soon"><p className="eyebrow">Delivery partner</p><h1>Your delivery workspace<br /><span>is on its way.</span></h1><p>The current backend does not yet include assigned-delivery endpoints. That screen will connect once delivery assignment and status updates are added.</p><Link className="button" to="/">Back to restaurants</Link></section>;
}
