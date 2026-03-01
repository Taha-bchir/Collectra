'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  ApiError,
  type TeamMember,
  type TeamPermissions,
  inviteTeamMember,
  listTeamMembers,
  updateTeamMemberRole,
  updateTeamMemberStatus,
} from '@/features/team/services/team-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Copy, Loader2 } from 'lucide-react';

type InviteResultState = {
  inviteLink: string | null;
  token: string | null;
  message: string;
  expiresAt: string;
} | null;

const ROLE_OPTIONS = [
  { value: 'AGENT', label: 'Agent' },
  { value: 'MANAGER', label: 'Manager' },
] as const;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export default function TeamPage() {
  const { profile, isAuthenticated } = useAuth();
  const router = useRouter();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [permissions, setPermissions] = useState<TeamPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'AGENT' | 'MANAGER'>('AGENT');
  const [inviteResult, setInviteResult] = useState<InviteResultState>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<'AGENT' | 'MANAGER'>('AGENT');
  const [roleLoading, setRoleLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const canManage = permissions?.canManageMembers ?? false;

  const fetchMembers = async () => {
    try {
      const { members: list, permissions: teamPermissions } = await listTeamMembers();
      setMembers(list);
      setPermissions(teamPermissions);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load team members'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    fetchMembers();
  }, [isAuthenticated, router]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return toast.error('Email is required');

    setInviteLoading(true);
    try {
      const result = await inviteTeamMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setInviteResult({
        inviteLink: result.inviteLink,
        token: result.token,
        message: result.message,
        expiresAt: result.expiresAt,
      });
      setInviteEmail('');
      toast.success('Invitation created successfully');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to send invitation'));
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedMember) return;

    setRoleLoading(true);
    try {
      const updated = await updateTeamMemberRole(selectedMember.id, newRole);
      setMembers((prev) => prev.map((member) => (member.id === selectedMember.id ? updated : member)));
      toast.success('Role updated successfully');
      setSelectedMember(null);
      setRoleDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update role'));
    } finally {
      setRoleLoading(false);
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    const newStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setStatusLoading(member.id);

    try {
      const updated = await updateTeamMemberStatus(member.id, newStatus);
      setMembers((prev) => prev.map((item) => (item.id === member.id ? updated : item)));
      toast.success(`Member ${newStatus.toLowerCase()} successfully`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update status'));
    } finally {
      setStatusLoading(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading team members...</div>;
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team & Members</h1>
      </div>

      {/* Invite Section – visible only to managers/owners */}
      {canManage && (
        <div className="p-6 border rounded-lg bg-card shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Invite New Member</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Enter email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
              disabled={inviteLoading}
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'AGENT' | 'MANAGER')}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((roleOption) => (
                  <SelectItem key={roleOption.value} value={roleOption.value}>{roleOption.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invite'
              )}
            </Button>
          </div>

          {inviteResult && (
            <div className="mt-4 p-4 bg-muted/50 rounded border">
              <p className="text-sm font-medium mb-2">{inviteResult.message}</p>

              {inviteResult.inviteLink && (
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 bg-background p-2 rounded break-all text-sm">
                    {inviteResult.inviteLink}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteResult.inviteLink ?? '');
                      toast.success('Invite link copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              )}

              {!inviteResult.inviteLink && inviteResult.token && (
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 bg-background p-2 rounded break-all text-sm">
                    {inviteResult.token}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteResult.token ?? '');
                      toast.success('Invite token copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Token
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-2">
                Next step: send this invite to the member securely. It expires on{' '}
                {new Date(inviteResult.expiresAt).toLocaleString()}.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground py-8">
                  No members in this workspace yet.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.fullName || 'Unnamed'}
                    {member.id === profile?.id && (
                      <Badge variant="secondary" className="ml-2">You</Badge>
                    )}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'OWNER' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === 'ACTIVE' ? 'default' : 'destructive'}>
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(member.joinedAt).toLocaleDateString()}</TableCell>
                  {canManage && (
                    <TableCell className="text-right space-x-2">
                      {/* Role Change */}
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSelectedMember(member);
                        setNewRole(member.role === 'AGENT' ? 'AGENT' : 'MANAGER');
                        setRoleDialogOpen(true);
                      }} disabled={member.role === 'OWNER' || member.id === profile?.id}>
                        Change Role
                      </Button>

                      {/* Status Toggle */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant={member.status === 'ACTIVE' ? 'destructive' : 'default'}
                            size="sm"
                            disabled={statusLoading === member.id || member.role === 'OWNER' || member.id === profile?.id}
                          >
                            {statusLoading === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : member.status === 'ACTIVE' ? (
                              'Deactivate'
                            ) : (
                              'Reactivate'
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {member.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'} {member.email}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.status === 'ACTIVE'
                                ? 'This member will lose access to the workspace until reactivated.'
                                : 'This member will regain full access immediately.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleToggleStatus(member)}>
                              Confirm
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={roleDialogOpen} onOpenChange={(open) => {
        setRoleDialogOpen(open);
        if (!open) {
          setSelectedMember(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMember ? `Change role for ${selectedMember.email}` : 'Change role'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as 'AGENT' | 'MANAGER')}>
              <SelectTrigger>
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((roleOption) => (
                  <SelectItem key={roleOption.value} value={roleOption.value}>{roleOption.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRoleDialogOpen(false);
              setSelectedMember(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={!selectedMember || newRole === selectedMember.role || roleLoading}
            >
              {roleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}