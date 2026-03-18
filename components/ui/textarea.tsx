import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input/80 placeholder:text-muted-foreground/90 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-24 w-full rounded-xl border bg-background px-3.5 py-3 text-base shadow-sm shadow-primary/5 transition-[border-color,background-color,box-shadow,color] outline-none hover:border-primary/20 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-50 dark:bg-input/30 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
