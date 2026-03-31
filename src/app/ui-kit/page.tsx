/**
 * UI Kit Demo Page
 * UI Constitution V1
 * 
 * Showcases all UI kit components using PageShell only.
 * No additional styling allowed - composition only.
 */

'use client';

import { useState } from 'react';
import {
  PageShell,
  TopBar,
  SideNav,
  Section,
  Grid,
  FrostedCard,
  Panel,
  StatCard,
  Button,
  IconButton,
  Input,
  Select,
  Textarea,
  Switch,
  Tabs,
  TabPanel,
  Badge,
  Tooltip,
  Modal,
  Drawer,
  BottomSheet,
  ToastProvider,
  useToast,
  DataRow,
  DataTable,
  CardList,
  Skeleton,
  EmptyState,
  ErrorState,
  Flex,
} from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { Home, Calendar, Table, Menu, DollarSign, TrendingUp, Plus, MoreVertical } from 'lucide-react';

function UIKitDemoContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const { showToast } = useToast();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: <Home className="w-4 h-4" /> },
    { label: 'Bookings', href: '/bookings', icon: <Calendar className="w-4 h-4" /> },
    { label: 'Calendar', href: '/calendar', icon: <Table className="w-4 h-4" /> },
  ];

  const tableData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' },
  ];

  const tableColumns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: typeof tableData[0]) => row.name,
      sortable: true,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row: typeof tableData[0]) => row.email,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: typeof tableData[0]) => (
        <Badge variant={row.status === 'Active' ? 'success' : 'default'}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <TopBar
        title="UI Kit Demo"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'UI Kit' }]}
        rightActions={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(true)}>
              <Menu className="w-4 h-4" />
            </Button>
          </>
        }
      />

      <div style={{ padding: tokens.spacing[6] }}>
        {/* Layout Primitives */}
        <Section heading="Layout Primitives" divider>
          <Grid gap={4}>
            <Grid.Col span={12} md={6} lg={4}>
              <FrostedCard header={<h3>Grid Column 1</h3>}>
                <p>Responsive grid with 12 columns</p>
              </FrostedCard>
            </Grid.Col>
            <Grid.Col span={12} md={6} lg={4}>
              <FrostedCard header={<h3>Grid Column 2</h3>}>
                <p>Desktop: 4 columns, Tablet: 6 columns, Mobile: 12 columns</p>
              </FrostedCard>
            </Grid.Col>
            <Grid.Col span={12} md={6} lg={4}>
              <FrostedCard header={<h3>Grid Column 3</h3>}>
                <p>All spacing tokenized</p>
              </FrostedCard>
            </Grid.Col>
          </Grid>
        </Section>

        {/* Surface Components */}
        <Section heading="Surface Components" divider>
          <Grid gap={4}>
            <Grid.Col span={12} md={6}>
              <FrostedCard
                header={<h3>FrostedCard</h3>}
                footer={<Button>Action</Button>}
                interactive
              >
                <p>Frosted glass effect card with blur and shadow</p>
              </FrostedCard>
            </Grid.Col>
            <Grid.Col span={12} md={6}>
              <Panel>
                <p>Panel for dense data zones</p>
                <p>Used for tables and calendar surfaces</p>
              </Panel>
            </Grid.Col>
            <Grid.Col span={12} md={4}>
              <StatCard
                label="Total Revenue"
                value="$12,345"
                delta={{ value: 12, trend: 'up' }}
                icon={<DollarSign className="w-4 h-4" />}
              />
            </Grid.Col>
            <Grid.Col span={12} md={4}>
              <StatCard
                label="Active Users"
                value="1,234"
                delta={{ value: -5, trend: 'down' }}
                loading
              />
            </Grid.Col>
            <Grid.Col span={12} md={4}>
              <StatCard
                label="Conversion"
                value="24%"
                delta={{ value: 0, trend: 'neutral' }}
                icon={<TrendingUp className="w-4 h-4" />}
              />
            </Grid.Col>
          </Grid>
        </Section>

        {/* Controls */}
        <Section heading="Controls" divider>
          <Grid gap={4}>
            <Grid.Col span={12}>
              <h4>Buttons</h4>
              <Flex gap={2} wrap>
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button isLoading>Loading</Button>
                <IconButton icon={<Plus className="w-4 h-4" />} aria-label="Add" />
                <Tooltip content="This is a tooltip">
                  <Button>Hover me</Button>
                </Tooltip>
              </Flex>
            </Grid.Col>

            <Grid.Col span={12} md={6}>
              <h4>Input</h4>
              <Input
                label="Email"
                helperText="Enter your email address"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="example@email.com"
              />
            </Grid.Col>

            <Grid.Col span={12} md={6}>
              <h4>Select</h4>
              <Select
                label="Country"
                options={[
                  { value: 'us', label: 'United States' },
                  { value: 'uk', label: 'United Kingdom' },
                ]}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <h4>Textarea</h4>
              <Textarea
                label="Message"
                placeholder="Enter your message"
                rows={4}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <h4>Switch</h4>
              <Switch
                checked={switchChecked}
                onChange={setSwitchChecked}
                label="Enable notifications"
                description="Receive push notifications"
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <h4>Tabs</h4>
              <Tabs
                tabs={[
                  { id: 'tab1', label: 'Tab 1' },
                  { id: 'tab2', label: 'Tab 2' },
                  { id: 'tab3', label: 'Tab 3' },
                ]}
                activeTab="tab1"
                onTabChange={() => {}}
              >
                <TabPanel id="tab1">Content 1</TabPanel>
                <TabPanel id="tab2">Content 2</TabPanel>
                <TabPanel id="tab3">Content 3</TabPanel>
              </Tabs>
            </Grid.Col>

            <Grid.Col span={12}>
              <h4>Badges</h4>
              <Flex gap={2} wrap>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="default">Default</Badge>
              </Flex>
            </Grid.Col>
          </Grid>
        </Section>

        {/* Overlays */}
        <Section heading="Overlays" divider>
          <Grid gap={4}>
            <Grid.Col span={12} md={4}>
              <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
            </Grid.Col>
            <Grid.Col span={12} md={4}>
              <Button onClick={() => setDrawerOpen(true)}>Open Drawer</Button>
            </Grid.Col>
            <Grid.Col span={12} md={4}>
              <Button onClick={() => setBottomSheetOpen(true)}>Open BottomSheet</Button>
            </Grid.Col>
            <Grid.Col span={12} md={4}>
              <Button
                onClick={() =>
                  showToast({ message: 'Success!', variant: 'success' })
                }
              >
                Show Toast
              </Button>
            </Grid.Col>
          </Grid>
        </Section>

        {/* Data Components */}
        <Section heading="Data Components" divider>
          <Grid gap={4}>
            <Grid.Col span={12}>
              <h4>DataRow</h4>
              <Panel padding={false}>
                <DataRow label="Email" value="user@example.com" copyable />
                <DataRow label="Phone" value="+1 (555) 123-4567" copyable />
                <DataRow label="Status" value="Active" />
              </Panel>
            </Grid.Col>

            <Grid.Col span={12}>
              <h4>DataTable</h4>
              <DataTable
                columns={tableColumns}
                data={tableData}
                sortable
                onSort={(col, dir) => console.log('Sort:', col, dir)}
                rowActions={(row) => (
                  <IconButton
                    icon={<MoreVertical className="w-4 h-4" />}
                    aria-label="Actions"
                    variant="ghost"
                  />
                )}
              />
            </Grid.Col>

            <Grid.Col span={12} md={6}>
              <h4>Skeleton</h4>
              <Skeleton height="100px" />
            </Grid.Col>

            <Grid.Col span={12} md={6}>
              <h4>EmptyState</h4>
              <EmptyState
                title="No items"
                description="Add your first item to get started"
                action={{ label: 'Add Item', onClick: () => {} }}
              />
            </Grid.Col>

            <Grid.Col span={12} md={6}>
              <h4>ErrorState</h4>
              <ErrorState
                title="Something went wrong"
                message="Failed to load data"
                action={<Button onClick={() => {}}>Retry</Button>}
              />
            </Grid.Col>
          </Grid>
        </Section>
      </div>

      {/* Overlays */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal Example"
      >
        <p>This is a modal dialog.</p>
        <p>Press Escape to close or click outside.</p>
      </Modal>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Navigation"
        placement="right"
      >
        <SideNav items={navItems} />
      </Drawer>

      <BottomSheet
        isOpen={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        title="Actions"
        dragHandle
      >
        <Flex direction="column" gap={2}>
          <Button>Action 1</Button>
          <Button variant="secondary">Action 2</Button>
        </Flex>
      </BottomSheet>
    </>
  );
}

export default function UIKitPage() {
  return (
    <PageShell>
      <ToastProvider>
        <UIKitDemoContent />
      </ToastProvider>
    </PageShell>
  );
}
