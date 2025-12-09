"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Wine, Package, Edit } from "lucide-react";
import Image from "next/image";

export interface Wine {
  id: string;
  name: string;
  type?: string;
  region?: string;
  country?: string;
  grape?: string;
  vintage?: number;
  label_image_url?: string;
  notes?: string;
  date_added?: string;
  quantity?: number;
}

interface WineCardProps {
  wine: Wine;
  onDelete: (id: string) => void;
  onEdit: (wine: Wine) => void;
}

export function WineCard({ wine, onDelete, onEdit }: WineCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onEdit(wine)}>
      {wine.label_image_url && (
        <div className="w-full h-64 relative rounded-t-lg overflow-hidden border-b">
          <Image
            src={wine.label_image_url}
            alt={wine.name}
            fill
            className="object-contain bg-background"
          />
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl mb-2">{wine.name}</CardTitle>
        <CardDescription>
          {wine.type && (
            <span className="block font-medium text-foreground">{wine.type}</span>
          )}
          {wine.grape && <span className="block">{wine.grape}</span>}
          {wine.country && <span className="block">{wine.country}</span>}
          {wine.region && <span className="block">{wine.region}</span>}
          {wine.vintage && <span className="block">Vintage: {wine.vintage}</span>}
          {wine.score !== null && wine.score !== undefined && (
            <span className="block flex items-center gap-1 mt-2 font-medium text-foreground">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {wine.score.toFixed(1)}/5
            </span>
          )}
          {wine.quantity !== undefined && (
            <span className="block flex items-center gap-1 mt-2 font-medium text-foreground">
              <Package className="h-3 w-3" />
              {wine.quantity} {wine.quantity === 1 ? "bottle" : "bottles"}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      {wine.notes && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{wine.notes}</p>
        </CardContent>
      )}
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(wine);
            }}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(wine.id);
            }}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

