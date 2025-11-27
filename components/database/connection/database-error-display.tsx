'use client';

import { XCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Field, FieldContent, FieldError } from '@/components/ui/field';

interface DatabaseErrorDisplayProps {
  error: string;
}

export function DatabaseErrorDisplay({ error }: DatabaseErrorDisplayProps) {
  return (
    <div className="mt-4 pt-4">
      <Separator className="mb-4" />
      <Field orientation="vertical" data-invalid="true">
        <FieldContent>
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-2">
                Connection Error
              </p>
              <FieldError>
                {error.split('\n').map((line, index) => (
                  <p key={index} className="text-xs">{line}</p>
                ))}
              </FieldError>
            </div>
          </div>
        </FieldContent>
      </Field>
    </div>
  );
}

