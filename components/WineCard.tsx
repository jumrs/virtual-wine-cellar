"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Wine } from "lucide-react";
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
}

interface WineCardProps {
  wine: Wine;
  onDelete: (id: string) => void;
}

export function WineCard({ wine, onDelete }: WineCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{wine.name}</CardTitle>
            <CardDescription>
              {wine.grape && <span className="block">{wine.grape}</span>}
              {wine.region && <span className="block">{wine.region}</span>}
              {wine.vintage && <span className="block">Vintage: {wine.vintage}</span>}
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
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(wine.id)}
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remove
        </Button>
      </CardContent>
    </Card>
  );
}

