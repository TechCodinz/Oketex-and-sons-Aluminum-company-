import { Link } from "react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { formatNGN, formatUSD } from "@/lib/money";
export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <div className="group border hairline bg-card flex flex-col transition-colors hover:border-primary/60">
      <Link to={`/product/${product.slug}`} className="block relative aspect-[4/3] overflow-hidden bg-secondary">
        {product.image && <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />}
        {product.stock <= 0 && <span className="absolute top-3 left-3 bg-destructive text-destructive-foreground font-tech text-[10px] uppercase tracking-widest px-2 py-1">Out of stock</span>}
        {product.featured && product.stock > 0 && <span className="absolute top-3 left-3 bg-primary text-primary-foreground font-tech text-[10px] uppercase tracking-widest px-2 py-1">Best seller</span>}
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <Link to={`/product/${product.slug}`} className="hover:text-primary transition-colors"><h3 className="font-display font-semibold text-lg leading-tight">{product.name}</h3></Link>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 flex-1">{product.summary}</p>
        <div className="flex items-end justify-between mt-4 gap-3">
          <div><div className="font-tech font-semibold text-base">{formatNGN(product.priceNgn)}</div><div className="font-tech text-[11px] text-muted-foreground">{product.unit} · {formatUSD(product.priceNgn)}</div></div>
          <button disabled={product.stock<=0} onClick={()=>{ add({productId:product.id,slug:product.slug,name:product.name,unit:product.unit,priceNgn:product.priceNgn,image:product.image},1); toast.success(`${product.name} added`); }} className="border hairline p-2.5 hover:bg-primary hover:border-primary hover:text-primary-foreground transition-colors disabled:opacity-40 cursor-pointer" aria-label={`Add ${product.name}`}><Plus className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
