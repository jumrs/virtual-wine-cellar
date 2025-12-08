"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Wine, Package, Edit } from "lucide-react";
import Image from "next/image";

export interface Wine {
  id: string;
  name: string;
  region?: string;
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
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{wine.name}</CardTitle>
            <CardDescription>
              {wine.grape && <span className="block">{wine.grape}</span>}
              {wine.region && <span className="block">{wine.region}</span>}
              {wine.vintage && <span className="block">Vintage: {wine.vintage}</span>}
              {wine.quantity !== undefined && (
                <span className="block flex items-center gap-1 mt-2 font-medium text-foreground">
                  <Package className="h-3 w-3" />
                  {wine.quantity} {wine.quantity === 1 ? "bottle" : "bottles"}
                </span>
              )}
            </CardDescription>
          </div>
          {wine.label_image_url && (
            <div className="ml-4 w-20 h-20 relative rounded overflow-hidden border">
              <Image
                src={wine.label_image_url}
                alt={wine.name}
                fill
                className="object-cover"
              />
            </div>
          )}
        </div>
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

