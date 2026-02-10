"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUserStore } from "@/store/user-store"
import { strings } from "@/lib/strings"

export default function AccountSettingsPage() {
  const router = useRouter()

  const user = useUserStore((state) => state.user)
  const loading = useUserStore((state) => state.loading)
  const error = useUserStore((state) => state.error)
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser)
  const updateProfile = useUserStore((state) => state.updateProfile)
  const changePassword = useUserStore((state) => state.changePassword)
  const deleteAccount = useUserStore((state) => state.deleteAccount)

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [profileMessage, setProfileMessage] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const [confirmDelete, setConfirmDelete] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setFullName(user.profile.fullName ?? "")
      setPhone(user.profile.phone ?? "")
    }
  }, [user])

  const isLoadingProfile = loading && !user
  const isSavingProfile = loading && !!user
  const isChangingPassword = loading
  const isDeleting = loading

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMessage(null)
    await updateProfile({
      fullName: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
    })
    if (!useUserStore.getState().error) {
      setProfileMessage(strings.settings_profile_success)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (!newPassword || newPassword.length < 8) {
      setPasswordMessage(strings.settings_password_error_min_length)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage(strings.settings_password_error_mismatch)
      return
    }

    await changePassword(newPassword)
    if (useUserStore.getState().error) {
      setPasswordMessage(useUserStore.getState().error ?? strings.settings_password_error)
    } else {
      setPasswordMessage(strings.settings_password_success)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteError(null)

    if (confirmDelete !== "DELETE") {
      setDeleteError(strings.settings_delete_error_confirm)
      return
    }

    await deleteAccount()
    const err = useUserStore.getState().error
    if (err) {
      setDeleteError(err)
    } else {
      router.push("/auth/login")
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{strings.settings_account_title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {strings.settings_account_description}
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="profile">{strings.settings_tab_profile}</TabsTrigger>
            <TabsTrigger value="password">{strings.settings_tab_password}</TabsTrigger>
            <TabsTrigger value="danger">{strings.settings_tab_danger}</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <Card className="border border-border/60 bg-card/60 shadow-sm">
              <div className="flex flex-col gap-6 p-6 md:p-8">
                <div>
                  <h2 className="text-lg font-semibold">{strings.settings_profile_title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {strings.settings_profile_description}
                  </p>
                </div>

                <Separator />

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName">{strings.settings_profile_full_name}</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={strings.settings_profile_full_name_placeholder}
                        disabled={isLoadingProfile || isSavingProfile}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">{strings.settings_profile_phone}</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={strings.settings_profile_phone_placeholder}
                        disabled={isLoadingProfile || isSavingProfile}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">{strings.settings_profile_email}</Label>
                    <Input id="email" value={email} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">
                      {strings.settings_profile_email_note}
                    </p>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {profileMessage && !error && (
                    <p className="text-sm text-muted-foreground">{profileMessage}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={isSavingProfile || isLoadingProfile}>
                      {isSavingProfile ? strings.settings_profile_saving : strings.settings_profile_save}
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="password" className="mt-4">
            <Card className="border border-border/60 bg-card/60 shadow-sm">
              <div className="flex flex-col gap-6 p-6 md:p-8">
                <div>
                  <h2 className="text-lg font-semibold">{strings.settings_password_title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {strings.settings_password_description}
                  </p>
                </div>

                <Separator />

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword">{strings.settings_password_current}</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={strings.settings_password_current_placeholder}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword">{strings.settings_password_new}</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={strings.settings_password_new_placeholder}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword">{strings.settings_password_confirm}</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={strings.settings_password_confirm_placeholder}
                      />
                    </div>
                  </div>

                  {passwordMessage && (
                    <p className="text-sm text-muted-foreground">{passwordMessage}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={isChangingPassword}>
                      {isChangingPassword ? strings.settings_password_updating : strings.settings_password_update}
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="danger" className="mt-4">
            <Card className="border-destructive/60 bg-destructive/5 shadow-sm">
              <div className="flex flex-col gap-6 p-6 md:p-8">
                <div>
                  <h2 className="text-lg font-semibold text-destructive">{strings.settings_delete_title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {strings.settings_delete_description}
                  </p>
                </div>

                <Separator />

                <form onSubmit={handleDeleteAccount} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmDelete">
                      {strings.settings_delete_confirm_label}{" "}
                      <span className="font-mono font-semibold">DELETE</span>{" "}
                      {strings.settings_delete_confirm_suffix}.
                    </Label>
                    <Input
                      id="confirmDelete"
                      value={confirmDelete}
                      onChange={(e) => setConfirmDelete(e.target.value)}
                      placeholder={strings.settings_delete_confirm_placeholder}
                    />
                  </div>

                  {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

                  <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
                    <p className="text-xs text-muted-foreground">
                      {strings.settings_delete_warning}
                    </p>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={isDeleting}
                      className="min-w-[200px]"
                    >
                      {isDeleting ? strings.settings_delete_deleting : strings.settings_delete_button}
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
