import React from 'react';
import { GlassSurface } from '@/src/components/ui';
import { cardStyle } from './styles';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type ICardProps = React.ComponentPropsWithoutRef<typeof GlassSurface> &
  VariantProps<typeof cardStyle> & {
    className?: string;
    size?: 'default' | 'sm';
  };

const Card = React.forwardRef<React.ComponentRef<typeof GlassSurface>, ICardProps>(
  function Card({ className, size = 'default', ...props }, ref) {
    return (
      <GlassSurface
        className={cardStyle({ size, class: className })}
        {...props}
        ref={ref}
      />
    );
  }
);

Card.displayName = 'Card';

export { Card };
