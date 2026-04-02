import Layout from "../components/Layout";
import Dashboard from "../pages/Dashboard";
import Tasks from "../pages/Tasks";
import TaskDetail from "../pages/TaskDetail";
import Calendar from "../pages/Calendar";
import Messages from "../pages/Messages";
import Drive from "../pages/Drive";
import Members from "../pages/Members";
import Settings from "../pages/Settings";

export const appRoutes = [
    {
        path: "/dashboard",
        element: (
            <Layout>
                <Dashboard />
            </Layout>
        ),
    },
    {
        path: "/tasks",
        element: (
            <Layout>
                <Tasks />
            </Layout>
        ),
    },
    {
        path: "/tasks/:taskId",
        element: (
            <Layout>
                <TaskDetail />
            </Layout>
        ),
    },
    {
        path: "/calendar",
        element: (
            <Layout>
                <Calendar />
            </Layout>
        ),
    },
    {
        path: "/messages",
        element: (
            <Layout>
                <Messages />
            </Layout>
        ),
    },
    {
        path: "/drive",
        element: (
            <Layout>
                <Drive />
            </Layout>
        ),
    },
    {
        path: "/members",
        element: (
            <Layout>
                <Members />
            </Layout>
        ),
    },
    {
        path: "/settings",
        element: (
            <Layout>
                <Settings />
            </Layout>
        ),
    },
];

