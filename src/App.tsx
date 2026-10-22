import { Routes, Route } from "react-router";
import { SiteShell } from "@/components/SiteShell";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import Track from "./pages/Track";
import Quote from "./pages/Quote";
import Gallery from "./pages/Gallery";
import Assistant from "./pages/Assistant";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import SnapMeasure from "./pages/SnapMeasure";
import Visualizer from "./pages/Visualizer";
import Tools from "./pages/Tools";
import Services from "./pages/Services";
import Workspace from "./pages/Workspace";
import Book from "./pages/Book";
import Build from "./pages/Build";
import Estimator from "./pages/Estimator";
import Partners from "./pages/Partners";
import PartnerProfile from "./pages/PartnerProfile";
import Join from "./pages/Join";
import PartnerStatus from "./pages/PartnerStatus";
export default function App(){
 return (<SiteShell><Routes>
  <Route path="/" element={<Home />} />
  <Route path="/shop" element={<Shop />} />
  <Route path="/product/:slug" element={<ProductDetail />} />
  <Route path="/checkout" element={<Checkout />} />
  <Route path="/track" element={<Track />} />
  <Route path="/quote" element={<Quote />} />
  <Route path="/estimator" element={<Estimator />} />
  <Route path="/snap-measure" element={<SnapMeasure />} />
  <Route path="/visualizer" element={<Visualizer />} />
  <Route path="/tools" element={<Tools />} />
  <Route path="/workspace" element={<Workspace />} />
  <Route path="/book" element={<Book />} />
  <Route path="/partners" element={<Partners />} />
  <Route path="/partners/:code" element={<PartnerProfile />} />
  <Route path="/join" element={<Join />} />
  <Route path="/partner-status" element={<PartnerStatus />} />
  <Route path="/build" element={<Build />} />
  <Route path="/services" element={<Services />} />
  <Route path="/gallery" element={<Gallery />} />
  <Route path="/assistant" element={<Assistant />} />
  <Route path="/account" element={<Account />} />
  <Route path="/admin" element={<Admin />} />
  <Route path="/login" element={<Account />} />
  <Route path="*" element={<NotFound />} />
 </Routes></SiteShell>);
}
