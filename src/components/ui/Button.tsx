import type { ComponentProps, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink' | 'paper'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold ' +
  'transition-[transform,background-color,box-shadow,color,border-color] duration-150 ease-out ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50'

// Only "block" variants (primary, danger, ink, paper) carry the hard shadow:
// it signals the main action instead of decorating everything.
const BLOCK =
  'border-2 border-edge shadow-block-sm hover:-translate-x-px hover:-translate-y-px hover:shadow-block ' +
  'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${BLOCK} bg-primary text-primary-fg hover:bg-primary-hover`,
  danger: `${BLOCK} bg-danger text-white`,
  ink: `${BLOCK} bg-ink text-paper dark:bg-paper dark:text-ink`,
  paper: `${BLOCK} bg-paper text-ink`,
  secondary: 'border-2 border-line bg-surface text-fg hover:border-fg-subtle active:translate-y-px',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg active:translate-y-px',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-sm px-3 text-sm',
  md: 'h-10 rounded-md px-4 text-sm',
  lg: 'h-12 rounded-md px-5 text-base',
  xl: 'h-16 rounded-lg px-8 font-display text-xl',
}

// eslint-disable-next-line react-refresh/only-export-components
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
}

export function Button({
  variant,
  size,
  icon,
  iconRight,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: CommonProps & ComponentProps<'button'> & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {iconRight}
    </button>
  )
}

export function ButtonLink({ variant, size, icon, iconRight, className, children, ...rest }: CommonProps & LinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  )
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: { label: string; icon: ReactNode; variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' } & Omit<
  ComponentProps<'button'>,
  'children'
>) {
  const dims = size === 'sm' ? 'size-8 rounded-sm' : size === 'lg' ? 'size-12 rounded-md' : 'size-10 rounded-md'
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(BASE, VARIANTS[variant], dims, 'p-0', className)}
      {...rest}
    >
      {icon}
    </button>
  )
}
