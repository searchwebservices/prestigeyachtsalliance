import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Anchor,
  Users,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Calendar,
  MessageSquare,
  Pencil,
  Save,
  X,
  Star,
  Copy,
  Download,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ImageManager from './ImageManager';
import { format } from 'date-fns';
import { useExchangeRate, convertToMXN, formatMXN } from '@/hooks/useExchangeRate';

interface Yacht {
  id: string;
  name: string;
  slug: string;
  vessel_type: string;
  capacity: number;
  team_description: string | null;
  sales_description: string | null;
  public_price: number | null;
  commission_amount: number | null;
  owner_notes: string | null;
  cal_embed_url: string | null;
  is_flagship: boolean | null;
}

interface YachtImage {
  id: string;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean | null;
  display_order: number | null;
}

interface YachtDetailProps {
  yacht: Yacht;
  images: YachtImage[];
  onUpdate?: () => void;
  defaultImage?: string;
  onCopy?: (content: string, context?: string) => void;
}

export default function YachtDetail({ yacht, images, onUpdate, defaultImage, onCopy }: YachtDetailProps) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { rate: mxnRate, fetchedAt: rateFetchedAt } = useExchangeRate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Yacht>>({});

  const handleCopy = async (text: string, context: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${context} copied to clipboard.`,
    });
    onCopy?.(text, context);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not set';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyPlain = (amount: number | null) => {
    if (!amount) return 'Not set';
    return `$${amount.toLocaleString()} USD`;
  };

  const formatCurrencyWithMXN = (amount: number | null) => {
    if (!amount) return 'Not set';
    const mxnAmount = convertToMXN(amount, mxnRate);
    return `$${amount.toLocaleString()} USD (${formatMXN(mxnAmount)})`;
  };

  const handleExportAll = () => {
    const content = `${yacht.name}
${yacht.vessel_type} • Up to ${yacht.capacity} guests
${yacht.is_flagship ? '⭐ Flagship Vessel' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEAM DESCRIPTION
${yacht.team_description || 'No description available.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SALES DESCRIPTION
${yacht.sales_description || 'No sales description available.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRICING
Public Sales Price: ${formatCurrencyWithMXN(yacht.public_price)}
Commission Amount: ${formatCurrencyWithMXN(yacht.commission_amount)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OWNER NOTES
${yacht.owner_notes || 'No notes available.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMAGES (${images.length} available)
${images.map((img, i) => `${i + 1}. ${img.image_url}`).join('\n') || 'No images available.'}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${yacht.slug || yacht.name.toLowerCase().replace(/\s+/g, '-')}-info-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    link.click();

    toast({
      title: 'Exported!',
      description: 'Yacht information exported.',
    });
    onCopy?.('Full yacht export', 'Export');
  };

  const handleCopyAll = async () => {
    const content = `${yacht.name}
${yacht.vessel_type} • Up to ${yacht.capacity} guests

TEAM DESCRIPTION:
${yacht.team_description || 'No description available.'}

SALES DESCRIPTION:
${yacht.sales_description || 'No sales description available.'}

PRICING:
Public Sales Price: ${formatCurrencyWithMXN(yacht.public_price)}
Commission Amount: ${formatCurrencyWithMXN(yacht.commission_amount)}

OWNER NOTES:
${yacht.owner_notes || 'No notes available.'}`;

    await navigator.clipboard.writeText(content);
    toast({
      title: 'Copied!',
      description: 'All yacht information copied to clipboard.',
    });
    onCopy?.(content, 'All info');
  };

  const handleCopyImageUrls = async () => {
    const urls = images.map(img => img.image_url).join('\n');
    await navigator.clipboard.writeText(urls);
    toast({
      title: 'Copied!',
      description: `${images.length} image URLs copied to clipboard.`,
    });
    onCopy?.(urls, 'Image URLs');
  };

  const handleDownloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${yacht.slug || yacht.name.toLowerCase().replace(/\s+/g, '-')}-image-${index + 1}.jpg`;
      link.click();
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleEdit = () => {
    setEditData({
      team_description: yacht.team_description,
      sales_description: yacht.sales_description,
      public_price: yacht.public_price,
      commission_amount: yacht.commission_amount,
      owner_notes: yacht.owner_notes,
      cal_embed_url: yacht.cal_embed_url,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    const { error } = await supabase
      .from('yachts')
      .update(editData)
      .eq('id', yacht.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error saving',
        description: error.message,
      });
    } else {
      toast({
        title: 'Saved',
        description: 'Yacht information updated successfully.',
      });
      setIsEditing(false);
      onUpdate?.();
    }
    
    setIsSaving(false);
  };

  const CopyButton = ({ text, context, size = 'sm' }: { text: string; context: string; size?: 'sm' | 'icon' }) => {
    if (!text) return null;
    
    if (size === 'icon') {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy(text, context);
          }}
          title={`Copy ${context}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleCopy(text, context)}
      >
        <Copy className="h-3.5 w-3.5 mr-1.5" />
        Copy
      </Button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Anchor className="w-7 h-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">{yacht.name}</h1>
              {yacht.is_flagship && (
                <Badge className="bg-gold text-primary-foreground border-0 gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Flagship
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {yacht.vessel_type} • Up to {yacht.capacity} guests
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                <Copy className="w-4 h-4 mr-2" />
                Copy All
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportAll}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </>
          )}
          {isAdmin && (
            <>
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="overview" className="gap-2">
            <FileText className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Sales Info
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="w-4 h-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-2">
            <Calendar className="w-4 h-4" />
            Availability
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Team Description
                    </CardTitle>
                    <CardDescription>Internal information for the sales team</CardDescription>
                  </div>
                  {!isEditing && yacht.team_description && (
                    <CopyButton text={yacht.team_description} context="Team description" size="icon" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={editData.team_description || ''}
                    onChange={(e) => setEditData({ ...editData, team_description: e.target.value })}
                    placeholder="Enter team description..."
                    rows={6}
                  />
                ) : (
                  <p className="text-foreground whitespace-pre-wrap">
                    {yacht.team_description || 'No description available.'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Owner Notes
                    </CardTitle>
                    <CardDescription>Important notes from the yacht owner</CardDescription>
                  </div>
                  {!isEditing && yacht.owner_notes && (
                    <CopyButton text={yacht.owner_notes} context="Owner notes" size="icon" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={editData.owner_notes || ''}
                    onChange={(e) => setEditData({ ...editData, owner_notes: e.target.value })}
                    placeholder="Enter owner notes..."
                    rows={6}
                  />
                ) : (
                  <p className="text-foreground whitespace-pre-wrap">
                    {yacht.owner_notes || 'No notes available.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Info Tab */}
        <TabsContent value="sales" className="mt-6">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Sales Description
                  </CardTitle>
                  <CardDescription>Copy for prospect clients and marketing materials</CardDescription>
                </div>
                {!isEditing && yacht.sales_description && (
                  <CopyButton text={yacht.sales_description} context="Sales description" size="icon" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editData.sales_description || ''}
                  onChange={(e) => setEditData({ ...editData, sales_description: e.target.value })}
                  placeholder="Enter sales description..."
                  rows={10}
                />
              ) : (
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {yacht.sales_description || 'No sales description available.'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-success" />
                      Public Sales Price
                    </CardTitle>
                    <CardDescription>Price to quote to clients</CardDescription>
                  </div>
                  {!isEditing && yacht.public_price && (
                    <CopyButton text={formatCurrencyWithMXN(yacht.public_price)} context="Price" size="icon" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-2">
                    <Label>Price (USD)</Label>
                    <Input
                      type="number"
                      value={editData.public_price || ''}
                      onChange={(e) => setEditData({ ...editData, public_price: parseFloat(e.target.value) || null })}
                      placeholder="0.00"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl font-semibold text-success">
                      {formatCurrency(yacht.public_price)}
                    </p>
                    {yacht.public_price && (
                      <p className="text-lg text-muted-foreground mt-1">
                        {formatMXN(convertToMXN(yacht.public_price, mxnRate))}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-gold" />
                      Commission Amount
                    </CardTitle>
                    <CardDescription>Your commission per booking</CardDescription>
                  </div>
                  {!isEditing && yacht.commission_amount && (
                    <CopyButton text={formatCurrencyWithMXN(yacht.commission_amount)} context="Commission" size="icon" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-2">
                    <Label>Commission (USD)</Label>
                    <Input
                      type="number"
                      value={editData.commission_amount || ''}
                      onChange={(e) => setEditData({ ...editData, commission_amount: parseFloat(e.target.value) || null })}
                      placeholder="0.00"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl font-semibold text-gold">
                      {formatCurrency(yacht.commission_amount)}
                    </p>
                    {yacht.commission_amount && (
                      <p className="text-lg text-muted-foreground mt-1">
                        {formatMXN(convertToMXN(yacht.commission_amount, mxnRate))}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Exchange Rate Info */}
          {rateFetchedAt && (
            <p className="text-xs text-muted-foreground mt-4">
              Exchange rate updated: {format(rateFetchedAt, 'MMM d, yyyy')} (1 USD = {mxnRate.toFixed(2)} MXN)
            </p>
          )}

          {/* Deposit Payment Section */}
          <Card className="mt-6 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Charter Deposit
              </CardTitle>
              <CardDescription>Secure the reservation with a refundable deposit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-2xl font-bold text-primary">$500 USD</p>
                  <p className="text-sm text-muted-foreground">{formatMXN(convertToMXN(500, mxnRate))} - Refundable Deposit</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText('https://buy.stripe.com/7sY3cu0AL1eZ70Lg9Df3a01');
                      toast({ title: 'Copied!', description: 'Payment link copied to clipboard' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => window.open('https://buy.stripe.com/7sY3cu0AL1eZ70Lg9Df3a01', '_blank')}
                  >
                    Pay Deposit
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Refunds are evaluated on a case-by-case basis. Acts of god (weather, natural disasters, etc.) are always fully refundable.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="mt-6">
          {isAdmin ? (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Manage Images
                </CardTitle>
                <CardDescription>Upload, crop, and manage yacht photos</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageManager
                  yachtId={yacht.id}
                  yachtName={yacht.name}
                  images={images}
                  onUpdate={onUpdate || (() => {})}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-primary" />
                      Yacht Gallery
                    </CardTitle>
                    <CardDescription>Photos available for marketing and sales</CardDescription>
                  </div>
                  {images.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleCopyImageUrls}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy URLs
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {images.length > 0 || defaultImage ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {defaultImage && images.length === 0 && (
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted group col-span-2">
                        <img
                          src={defaultImage}
                          alt={yacht.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs">
                          Primary
                        </Badge>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDownloadImage(defaultImage, 0)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                    {images.map((image, index) => (
                      <div
                        key={image.id}
                        className="relative aspect-video rounded-lg overflow-hidden bg-muted group"
                      >
                        <img
                          src={image.image_url}
                          alt={image.alt_text || yacht.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {image.is_primary && (
                          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs">
                            Primary
                          </Badge>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopy(image.image_url, 'Image URL')}
                            title="Copy URL"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDownloadImage(image.image_url, index)}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                    <p>No images available yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability" className="mt-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Booking Calendar
              </CardTitle>
              <CardDescription>View and manage availability</CardDescription>
              {isEditing && (
                <div className="mt-4 space-y-2">
                  <Label>Cal.com Embed URL</Label>
                  <Input
                    value={editData.cal_embed_url || ''}
                    onChange={(e) => setEditData({ ...editData, cal_embed_url: e.target.value })}
                    placeholder="https://cal.com/your-calendar"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {yacht.cal_embed_url ? (
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                  <iframe
                    src={yacht.cal_embed_url}
                    className="w-full h-full min-h-[500px]"
                    frameBorder="0"
                    title={`${yacht.name} Availability Calendar`}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mb-4 opacity-50" />
                  <p>No calendar configured yet.</p>
                  {isAdmin && !isEditing && (
                    <Button variant="outline" className="mt-4" onClick={handleEdit}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Add Calendar URL
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
