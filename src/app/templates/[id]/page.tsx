/**
 * Edit Template Page - Enterprise Rebuild
 * 
 * Complete rebuild using design system and components.
 * Zero legacy styling - all through components and tokens.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Textarea,
  Skeleton,
  FormRow,
} from '@/components/ui';
import { OwnerAppShell } from '@/components/layout';
import { ArrowLeft, Loader2, Check } from 'lucide-react';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params?.id as string;

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch template');
      }
      const data = await response.json();
      if (data.template) {
        const tpl = data.template;
        setName(tpl.name || "");
        setType(tpl.type || "");
        setCategory(tpl.category || "");
        setTemplateKey(tpl.templateKey || "");
        setSubject(tpl.subject || "");
        setBody(tpl.body || "");
        setIsActive(tpl.isActive !== false);
      }
    } catch (err) {
      setError('Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId, fetchTemplate]);

  const handleSave = async () => {
    if (!name || !type || !category || !templateKey || !body) {
      alert("Name, type, category, templateKey, and body are required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          category,
          templateKey,
          subject,
          body,
          isActive,
        }),
      });

      if (response.ok) {
        router.push("/templates");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update template");
      }
    } catch (err) {
      setError("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = [
    { value: "", label: "Select type" },
    { value: "sms", label: "SMS" },
    { value: "email", label: "Email" },
  ];

  const categoryOptions = [
    { value: "", label: "Select category" },
    { value: "client", label: "Client" },
    { value: "sitter", label: "Sitter" },
    { value: "owner", label: "Owner" },
    { value: "report", label: "Report" },
    { value: "invoice", label: "Invoice" },
  ];

  return (
    <OwnerAppShell>
      <PageHeader
        title="Edit Template"
        description="Update your message template"
        actions={
          <Link href="/settings?section=templates">
            <Button variant="tertiary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Templates
            </Button>
          </Link>
        }
      />

      <div className="p-6">
        {error && (
          <Card className="mb-6 bg-status-danger-bg border-status-danger-border">
            <div className="p-4 text-status-danger-text">
              {error}
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton height={400} />
          </div>
        ) : (
          <>
            <Card className="mb-6">
              <div className="font-bold text-lg text-text-primary mb-4">
                Template Information
              </div>

              <div className="flex flex-col gap-4">
                <FormRow label="Name *">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </FormRow>

                <div className="grid grid-cols-2 gap-4">
                  <FormRow label="Type *">
                    <Select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      options={typeOptions}
                    />
                  </FormRow>

                  <FormRow label="Category *">
                    <Select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      options={categoryOptions}
                    />
                  </FormRow>
                </div>

                <FormRow label="Template Key *">
                  <Input
                    type="text"
                    value={templateKey}
                    onChange={(e) => setTemplateKey(e.target.value)}
                    placeholder="e.g., booking.confirmation"
                    required
                  />
                </FormRow>

                {type === "email" && (
                  <FormRow label="Subject">
                    <Input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </FormRow>
                )}

                <FormRow label="Body *">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    placeholder="Message body with {{variables}}"
                    required
                  />
                </FormRow>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="accent-accent-primary"
                  />
                  <label htmlFor="isActive" className="text-sm text-text-primary cursor-pointer">
                    Active
                  </label>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                variant="tertiary"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !name || !type || !category || !templateKey || !body}
                leftIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </>
        )}
      </div>
    </OwnerAppShell>
  );
}
