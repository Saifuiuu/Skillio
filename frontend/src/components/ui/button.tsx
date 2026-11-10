import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import Link, { type LinkProps } from "next/link"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 outline-none select-none cursor-pointer focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:brightness-90 active:scale-[0.98]",
        brand:
          "bg-brand text-brand-foreground hover:brightness-95 active:scale-[0.98] shadow-sm",
        secondary:
          "bg-ink text-ink-foreground hover:bg-ink/85 active:scale-[0.98] shadow-sm",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] aria-expanded:bg-muted aria-expanded:text-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground active:scale-[0.98] aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-[0.98] focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-brand underline-offset-4 hover:underline cursor-pointer",
      },
      size: {
        default: "h-9 min-h-[36px] px-3.5 gap-2 text-sm",
        sm: "h-8 min-h-[32px] px-3 gap-1.5 text-xs",
        lg: "h-10 min-h-[40px] px-4 gap-2 text-sm",
        pill: "h-10 min-h-[40px] px-4 gap-2 text-sm rounded-full",
        icon: "size-10 min-h-[40px] min-w-[40px] p-0",
        "icon-sm": "size-8 min-h-[32px] min-w-[32px] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />}
      {children}
    </ButtonPrimitive>
  )
}

type LinkButtonProps = LinkProps &
  VariantProps<typeof buttonVariants> & {
    className?: string
    children: React.ReactNode
    target?: string
    rel?: string
  }

function LinkButton({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </Link>
  )
}

export { Button, LinkButton, buttonVariants }
