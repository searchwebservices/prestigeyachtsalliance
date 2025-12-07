import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Anchor, Users, Star } from 'lucide-react';

interface YachtCardProps {
  name: string;
  vesselType: string;
  capacity: number;
  isFlagship?: boolean;
  imageUrl?: string;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export default function YachtCard({
  name,
  vesselType,
  capacity,
  isFlagship,
  imageUrl,
  isSelected,
  onClick,
  compact = false,
}: YachtCardProps) {
  return (
    <Card
      className={`
        overflow-hidden cursor-pointer transition-all duration-300 group
        ${isSelected 
          ? 'ring-2 ring-primary shadow-lg' 
          : 'hover:shadow-md border-border/50'
        }
      `}
      onClick={onClick}
    >
      {/* Image */}
      <div className={`relative overflow-hidden bg-muted ${compact ? 'h-24' : 'h-40'}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Anchor className={`text-muted-foreground/30 ${compact ? 'w-8 h-8' : 'w-12 h-12'}`} />
          </div>
        )}
        {isFlagship && (
          <Badge className={`absolute top-2 right-2 bg-gold text-primary-foreground border-0 gap-1 ${compact ? 'text-xs px-1.5 py-0.5' : ''}`}>
            <Star className={`fill-current ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
            {!compact && 'Flagship'}
          </Badge>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
        <div className={`absolute left-2 right-2 ${compact ? 'bottom-1.5' : 'bottom-3 left-3 right-3'}`}>
          <h3 className={`font-semibold text-primary-foreground truncate ${compact ? 'text-sm' : 'text-lg'}`}>
            {name}
          </h3>
        </div>
      </div>

      {/* Info */}
      <CardContent className={compact ? 'p-2' : 'p-4'}>
        <div className={`flex items-center justify-between ${compact ? 'text-xs' : 'text-sm'}`}>
          <span className="text-muted-foreground truncate">{vesselType}</span>
          <div className="flex items-center gap-1 text-foreground flex-shrink-0">
            <Users className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            <span>{capacity}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
