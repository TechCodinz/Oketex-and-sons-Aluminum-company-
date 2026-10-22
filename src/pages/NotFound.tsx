import { Link } from "react-router";
import { Button } from "@/components/ui/button";
export default function NotFound(){ return (<div className="mx-auto max-w-md px-4 py-32 text-center"><h1 className="font-display font-bold text-6xl">404</h1><p className="font-tech text-sm uppercase tracking-widest text-muted-foreground mt-2">Sheet not found</p><Button asChild className="mt-8 rounded-none font-display uppercase"><Link to="/">Back to home</Link></Button></div>); }
