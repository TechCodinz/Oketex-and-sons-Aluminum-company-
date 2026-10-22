import { useNavigate } from "react-router";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatNGN, formatUSD } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function CartDrawer() {
  const { lines, isOpen, closeCart, setQuantity, remove, totalNgn } = useCart();
  const navigate = useNavigate();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] bg-background border-l hairline flex flex-col p-0"
      >
        <SheetHeader className="px-6 py-5 border-b hairline">
          <SheetTitle className="font-display uppercase tracking-wider text-lg">
            Order Sheet
            <span className="font-tech text-xs text-muted-foreground ml-3">
              {lines.length} item{lines.length === 1 ? "" : "s"}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          {lines.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-tech text-sm text-muted-foreground uppercase tracking-widest">
                Cart is empty
              </p>
              <Button
                variant="link"
                className="mt-2 text-primary"
                onClick={() => {
                  closeCart();
                  navigate("/shop");
                }}
              >
                Browse the catalog <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          ) : (
            lines.map((line) => (
              <div
                key={line.productId}
                className="flex gap-4 py-5 border-b hairline"
              >
                {line.image && (
                  <img
                    src={line.image}
                    alt={line.name}
                    className="h-16 w-16 object-cover border hairline"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold leading-tight truncate">
                    {line.name}
                  </p>
                  <p className="font-tech text-[11px] text-muted-foreground mt-0.5">
                    {formatNGN(line.priceNgn)} · {line.unit}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border hairline">
                      <button
                        className="p-1.5 hover:text-primary transition-colors"
                        onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-tech text-sm w-10 text-center">
                        {line.quantity}
                      </span>
                      <button
                        className="p-1.5 hover:text-primary transition-colors"
                        onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => remove(line.productId)}
                      aria-label={`Remove ${line.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="font-tech text-sm text-right whitespace-nowrap">
                  {formatNGN(line.priceNgn * line.quantity)}
                </div>
              </div>
            ))
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t hairline px-6 py-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="label-tech">Total</span>
              <div className="text-right">
                <div className="font-display font-bold text-2xl text-primary">
                  {formatNGN(totalNgn)}
                </div>
                <div className="font-tech text-[11px] text-muted-foreground">
                  {formatUSD(totalNgn)} · delivery calculated at confirmation
                </div>
              </div>
            </div>
            <Button
              className="w-full rounded-none font-display uppercase tracking-wider h-12 text-base"
              onClick={() => {
                closeCart();
                navigate("/checkout");
              }}
            >
              Place order <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
