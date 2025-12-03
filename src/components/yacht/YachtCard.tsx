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
}

export default function YachtCard({
  name,
  vesselType,
  capacity,
  isFlagship,
  imageUrl,
  isSelected,
  onClick,
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
      <div className="relative h-40 overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Anchor className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        {isFlagship && (
          <Badge className="absolute top-3 right-3 bg-gold text-primary-foreground border-0 gap-1">
            <Star className="w-3 h-3 fill-current" />
            Flagship
          </Badge>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-lg font-semibold text-primary-foreground truncate">
            {name}
          </h3>
        </div>
      </div>

      {/* Info */}
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{vesselType}</span>
          <div className="flex items-center gap-1 text-foreground">
            <Users className="w-4 h-4" />
            <span>{capacity} guests</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
