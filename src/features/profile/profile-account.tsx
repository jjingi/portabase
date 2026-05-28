"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertCircle,
    Check,
    Copy,
    KeyRound,
    Loader2,
    Plus,
    Trash2,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { User } from "@/db/schema/02_user";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    useZodForm,
} from "@/components/ui/form";
import { EmailSchema, EmailSchemaType } from "./account.schema";
import { BetterAuthError } from "@/types/auth";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { timeAgo } from "@/utils/date-formatting";
import {
    createApiKeysAction,
    deleteApiKeyAction,
    getApiKeysAction,
} from "@/features/profile/profile.action";
import { copyToClipboardWithMeta } from "@/components/common/copy-button";

interface ProfileAccountProps {
    user: User;
    apiEnabled: boolean;
}

export function ProfileAccount({ user, apiEnabled }: ProfileAccountProps) {

    const router = useRouter();

    const [isAddApiKeyOpen, setIsAddApiKeyOpen] = useState(false);
    const [apiKeyName, setApiKeyName] = useState("");

    const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
    const [copiedApiKey, setCopiedApiKey] = useState(false);

    const emailForm = useZodForm({
        schema: EmailSchema,
        defaultValues: {
            email: user.email,
        },
    });

    const { mutate: updateEmail, isPending: isUpdatingEmail } = useMutation({
        mutationFn: async (values: EmailSchemaType) => {
            const { error } = await authClient.changeEmail({
                newEmail: values.email,
                callbackURL: window.location.href,
            });

            if (error) throw error;

            return values.email;
        },
        onSuccess: (newEmail) => {
            toast.success("Email updated successfully.");

            emailForm.reset({ email: newEmail });

            router.refresh();
        },
        onError: (error: BetterAuthError) => {
            if (error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
                toast.error(
                    "User already exists, use another email address!",
                );

                emailForm.reset({ email: user.email });

                router.refresh();
            } else {
                toast.error(
                    "An error occurred while trying to update your password!",
                );
            }
        },
    });

    const {
        mutate: resendVerificationEmail,
        isPending: isResendingVerification,
    } = useMutation({
        mutationFn: async () => {
            const currentEmailInput = emailForm.getValues("email");

            let error: BetterAuthError | null = null;

            if (currentEmailInput === user.email) {
                const sendVerification =
                    await authClient.sendVerificationEmail({
                        email: currentEmailInput,
                        callbackURL: window.location.href,
                    });

                error = sendVerification.error;
            } else {
                const result = await authClient.changeEmail({
                    callbackURL: window.location.href,
                    newEmail: currentEmailInput,
                });

                error = result.error;
            }

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Verification email resent successfully.");
        },
        onError: () => {
            toast.error("Failed to resend verification email.");
        },
    });

    const {
        data: apikeys,
        isLoading: isLoadingApiKeys,
        refetch: refetchApiKeys,
    } = useQuery({
        queryKey: ["apikeys"],
        queryFn: async () => {
            const result = await getApiKeysAction();

            if (result?.data?.success) {
                return result.data.value;
            }



            throw new Error("Failed to fetch API Keys");
        },
    });

    const { mutate: addApiKey, isPending: isAddingApikey } = useMutation({
        mutationFn: async () => {

            const result = await createApiKeysAction({
                name: apiKeyName || "My API Key"
            });
            console.log(result);
            if (!result?.data?.success) {
                throw new Error("Failed to create API Key");
            }

            return result;
        },

        onSuccess: (result: any) => {
            setCreatedApiKey(result.data.value.key);

            toast.success("API Key created successfully");

            setIsAddApiKeyOpen(false);
            setApiKeyName("");

            refetchApiKeys();
        },

        onError: (error: any) => {
            toast.error(error.message || "Failed to create API Key");
        },
    });

    const { mutate: revokeApiKey, isPending: isRevokingApiKey } =
        useMutation({
            mutationFn: async (id: string) => {
                const result = await deleteApiKeyAction({ id });

                if (!result?.data?.success) {
                    throw new Error("Failed to revoke API Key");
                }
            },

            onSuccess: () => {
                toast.success("API Key revoked successfully");

                refetchApiKeys();
            },

            onError: () => {
                toast.error("Failed to revoke API Key");
            },
        });

    const handleCopyApiKey = async () => {
        if (!createdApiKey) return;

        await copyToClipboardWithMeta(createdApiKey);

        setCopiedApiKey(true);

        toast.success("API Key copied");

        setTimeout(() => {
            setCopiedApiKey(false);
        }, 2000);
    };

    return (
        <>
            <div className="space-y-8 animate-in fade-in-50 duration-300">
                <div className="mb-6 space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Account Settings
                    </h2>

                    <p className="text-sm text-muted-foreground">
                        Update your email and preferences.
                    </p>
                </div>

                <div className="space-y-4">
                    <Form
                        form={emailForm}
                        onSubmit={(values) => updateEmail(values)}
                    >
                        <div className="grid gap-3">
                            <FormField
                                control={emailForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Email Address
                                        </FormLabel>

                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        placeholder="Your email address"
                                                    />
                                                </FormControl>

                                                <div className="flex flex-col md:flex-row gap-3">
                                                    <Button
                                                        type="submit"
                                                        variant="secondary"
                                                        disabled={
                                                            isUpdatingEmail ||
                                                            !emailForm.formState
                                                                .isDirty
                                                        }
                                                    >
                                                        {isUpdatingEmail && (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        )}

                                                        Update
                                                    </Button>

                                                    {!user.emailVerified && (
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                resendVerificationEmail()
                                                            }
                                                            disabled={
                                                                isResendingVerification ||
                                                                emailForm
                                                                    .formState
                                                                    .errors
                                                                    .email !==
                                                                undefined
                                                            }
                                                        >
                                                            {isResendingVerification && (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            )}

                                                            Resend Verification
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <FormMessage />
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {!user.emailVerified && (
                                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-md border border-amber-100 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400 max-w-xl">
                                    <AlertCircle className="w-4 h-4" />

                                    <span>
                                        Your email is not verified. Please check
                                        your inbox.
                                    </span>
                                </div>
                            )}
                        </div>
                    </Form>
                </div>

                {apiEnabled === true && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-lg font-medium">
                                API Keys
                            </h3>

                            <div className="text-sm text-muted-foreground">
                                Manage your personal access tokens for API
                                authentication
                            </div>
                        </div>

                        <Dialog
                            open={isAddApiKeyOpen}
                            onOpenChange={setIsAddApiKeyOpen}
                        >
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add API Key
                                </Button>
                            </DialogTrigger>

                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        Add New API Key
                                    </DialogTitle>

                                    <DialogDescription>
                                        Give a name to your API Key to identify
                                        it later.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">
                                            Key Name
                                        </Label>

                                        <Input
                                            id="name"
                                            placeholder="e.g. flow-1, LLM, Backend"
                                            value={apiKeyName}
                                            onChange={(e) =>
                                                setApiKeyName(e.target.value)
                                            }
                                        />
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setIsAddApiKeyOpen(false)
                                        }
                                    >
                                        Cancel
                                    </Button>

                                    <Button
                                        onClick={() => addApiKey()}
                                        disabled={isAddingApikey}
                                    >
                                        {isAddingApikey && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}

                                        Create API Key
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="border rounded-lg divide-y">
                        {isLoadingApiKeys ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : apikeys && apikeys.length > 0 ? (
                            apikeys.map((ak: any) => (
                                <ApiKeyRow
                                    key={ak.id}
                                    apikey={ak}
                                    onRevoke={(id) => revokeApiKey(id)}
                                    isRevoking={isRevokingApiKey}
                                />
                            ))
                        ) : (
                            <div className="p-4 text-center text-muted-foreground">
                                No API Key found.
                            </div>
                        )}
                    </div>
                </div>
                )}
            </div>

            <Dialog
                open={!!createdApiKey}
                onOpenChange={(open) => {
                    if (!open) {
                        setCreatedApiKey(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Your API Key</DialogTitle>

                        <DialogDescription>
                            This API Key will only be displayed once.
                            <br />
                            Copy it now before closing this dialog.
                            <br />
                            For security reasons, it cannot be viewed again.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Input
                                readOnly
                                value={createdApiKey || ""}
                                className="font-mono"
                            />

                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleCopyApiKey}
                            >
                                {copiedApiKey ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </Button>
                        </div>

                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                            Store this API Key securely. You will not be able
                            to see it again after closing this dialog.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={() => {
                                setCreatedApiKey(null);
                            }}
                        >
                            I copied my API Key
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ApiKeyRow({
                       apikey,
                       onRevoke,
                       isRevoking,
                   }: {
    apikey: any;
    onRevoke: (id: string) => void;
    isRevoking: boolean;
}) {
    return (
        <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <KeyRound className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                    <div className="font-medium text-sm">
                        {apikey.name || "Unnamed API Key"}
                    </div>

                    {apikey?.start && apikey?.prefix ? (
                        <div className="text-xs font-mono text-muted-foreground">
                            {apikey.start}••••••••
                        </div>
                    ) : null}

                    <div className="text-xs text-muted-foreground">
                        Created {timeAgo(new Date(apikey.createdAt))}
                    </div>
                </div>
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onRevoke(apikey.id)}
                disabled={isRevoking}
            >
                {isRevoking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Trash2 className="w-4 h-4" />
                )}

                <span className="sr-only">Revoke</span>
            </Button>
        </div>
    );
}