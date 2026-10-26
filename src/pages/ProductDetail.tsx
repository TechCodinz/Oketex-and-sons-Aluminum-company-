import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { products, catalogue, categories, productPrice } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { formatNGN, formatUSD } from "@/lib/money";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
export default function ProductDetail(){
 const {slug}=useParams(); const product=catalogue().find(p=>p.slug===slug); const [qty,setQty]=useState(1); const {add}=useCart();
 if(!product) return (<div className="mx-auto max-w-7xl px-4 py-24 text-center"><p className="font-display text-2xl uppercase">Product not found</p><Link to="/shop" className="text-primary font-tech text-sm mt-4 inline-block">← Back to catalog</Link></div>);
 const cat=categories.find(c=>c.id===product.categoryId); const related=products.filter(p=>p.categoryId===product.categoryId && p.id!==product.id).slice(0,4); const price=productPrice(product);
 return (<div><div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 md:py-16"><Link to="/shop" className="inline-flex gap-2 font-tech text-xs uppercase tracking-widest text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Catalog</Link>
 <div className="grid lg:grid-cols-2 gap-10 mt-8"><div className="border hairline bg-card">{product.image && <img src={product.image} alt={product.name} className="w-full aspect-[4/3] object-cover" />}</div>
 <div><p className="font-tech text-[11px] uppercase tracking-[0.3em] text-primary">{cat?.name}</p><h1 className="font-display font-bold uppercase text-3xl md:text-5xl tracking-tight mt-2">{product.name}</h1><p className="text-muted-foreground mt-4">{product.description}</p>
 <div className="mt-8 border-y hairline py-5 flex items-baseline gap-4"><span className="font-display font-bold text-4xl text-primary">{formatNGN(price)}</span><span className="font-tech text-sm text-muted-foreground">{product.unit} · {formatUSD(price)}</span></div>
 <p className="font-tech text-xs mt-4 uppercase tracking-widest">{product.stock>0?<span className="text-emerald-400">{product.stock.toLocaleString()} units in stock</span>:<span className="text-destructive">Out of stock</span>}</p>
 <div className="flex items-stretch gap-4 mt-6"><div className="flex items-center border hairline"><button className="px-4 hover:text-primary" onClick={()=>setQty(Math.max(1,qty-1))} aria-label="Decrease"><Minus className="h-4 w-4" /></button><span className="font-tech text-lg w-14 text-center">{qty}</span><button className="px-4 hover:text-primary" onClick={()=>setQty(qty+1)} aria-label="Increase"><Plus className="h-4 w-4" /></button></div><Button disabled={product.stock<=0} className="flex-1 rounded-none h-14 font-display font-semibold uppercase tracking-wider" onClick={()=>{add({productId:product.id,slug:product.slug,name:product.name,unit:product.unit,priceNgn:price,image:product.image},qty); toast.success("Added to order sheet");}}>Add to order sheet</Button></div>
 <div className="grid grid-cols-2 gap-4 mt-8 text-sm"><div className="flex gap-2"><ShieldCheck className="h-5 w-5 text-primary shrink-0" /> Genuine full-gauge, verified at plant</div><div className="flex gap-2"><Truck className="h-5 w-5 text-primary shrink-0" /> Nationwide delivery, tracked</div></div>
 <div className="mt-8 border hairline"><div className="px-5 py-3 border-b hairline label-tech">Specifications</div>{Object.entries(product.specs).map(([k,v])=>(<div key={k} className="flex justify-between px-5 py-3 border-b hairline last:border-0 text-sm"><span className="text-muted-foreground">{k}</span><span className="font-tech">{v}</span></div>))}</div>
 </div></div>
 {related.length>0 && <><h2 className="font-display font-bold uppercase text-2xl mt-16 mb-6">Related materials</h2><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{related.map(p=><ProductCard key={p.id} product={p} />)}</div></>}
 </div></div>);
}
