/**
 * ZenTask Pro - Advanced Productivity App
 * Fully Functional Local JavaScript Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let state = {
        tasks: JSON.parse(localStorage.getItem('zt_tasks')) || [],
        workspaces: JSON.parse(localStorage.getItem('zt_workspaces')) || [
            { id: 'default', name: 'Personal' },
            { id: 'work', name: 'Work' },
            { id: 'study', name: 'Study' }
        ],
        activeWorkspace: localStorage.getItem('zt_active_workspace') || 'default',
        currentFilter: 'all', // all, pending, completed, high, critical
        currentView: 'tasks', // tasks (All), today, upcoming, overdue, completed (View)
        activeCategory: null,
        searchQuery: '',
        sortBy: 'due-asc', // created-desc, created-asc, due-asc, due-desc, priority-desc, priority-asc, alpha-asc, alpha-desc
        deletedTaskBuffer: null, // For undo functionality
        undoTimeoutId: null,
        streak: parseInt(localStorage.getItem('zt_streak')) || 0,
        lastCompletionDate: localStorage.getItem('zt_last_completion_date') || null,
        editTaskId: null
    };

    // --- DOM Elements ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const workspaceSelect = document.getElementById('workspace-select');
    const addWorkspaceBtn = document.getElementById('add-workspace-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const categoryListContainer = document.getElementById('category-list');
    
    // Stats
    const statStreak = document.getElementById('stat-streak');
    const statTodayDone = document.getElementById('stat-today-done');
    const statWeekDone = document.getElementById('stat-week-done');
    
    // Main UI
    const viewTitle = document.getElementById('view-title');
    const searchInput = document.getElementById('search-input');
    const taskCountText = document.getElementById('task-count');
    const progressPercentText = document.getElementById('progress-percent');
    const progressBarFill = document.getElementById('progress-bar-fill');
    
    // Controls & Toolbar
    const filterPills = document.querySelectorAll('.filter-pill');
    const sortSelect = document.getElementById('sort-select');
    const bulkDeleteBtn = document.getElementById('bulk-delete-completed');
    
    // Quick Add
    const quickAddCard = document.querySelector('.quick-add-card');
    const taskTitleInput = document.getElementById('task-title-input');
    const taskDescInput = document.getElementById('task-desc-input');
    const taskPriority = document.getElementById('task-priority');
    const taskCategory = document.getElementById('task-category');
    const taskDue = document.getElementById('task-due');
    const taskTags = document.getElementById('task-tags');
    const taskColor = document.getElementById('task-color');
    const taskRecurrence = document.getElementById('task-recurrence');
    const addTaskBtn = document.getElementById('add-task-btn');
    const voiceBtn = document.getElementById('voice-input-btn');
    const quickAddDetails = document.getElementById('quick-add-details');
    
    // Task List Container
    const taskList = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');
    
    // Snackbar
    const undoSnackbar = document.getElementById('undo-snackbar');
    const undoBtn = document.getElementById('undo-btn');
    
    // Edit Modal
    const taskModal = document.getElementById('task-modal');
    const closeModal = document.getElementById('close-modal');
    const editTitle = document.getElementById('edit-title');
    const editDescription = document.getElementById('edit-description');
    const editPriority = document.getElementById('edit-priority');
    const editCategory = document.getElementById('edit-category');
    const editDue = document.getElementById('edit-due');
    const editRecurrence = document.getElementById('edit-recurrence');
    const editTags = document.getElementById('edit-tags');
    const editColor = document.getElementById('edit-color');
    const editNotes = document.getElementById('edit-notes');
    const attachmentList = document.getElementById('attachment-list');
    const editAttachmentInput = document.getElementById('edit-attachment');
    const subtaskList = document.getElementById('subtask-list');
    const subtaskInput = document.getElementById('subtask-input');
    const addSubtaskBtn = document.getElementById('add-subtask-btn');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const saveEditBtn = document.getElementById('save-edit');
    
    // Footer / Theme Controls
    const themeToggle = document.getElementById('theme-toggle');
    const themeIconSun = document.getElementById('theme-icon-sun');
    const themeIconMoon = document.getElementById('theme-icon-moon');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFileInput = document.getElementById('import-file-input');
    const fabAdd = document.getElementById('fab-add');

    // Current attachments & subtasks buffer for modal editing
    let currentAttachments = [];
    let currentSubtasks = [];

    // --- Initialization ---
    function init() {
        renderWorkspaces();
        renderCategories();
        updateStats();
        renderTasks();
        setupTheme();
        requestNotificationPermission();
        checkDeadlinesPeriodically();
        
        // Setup quick add toggle behaviour
        taskTitleInput.addEventListener('focus', () => {
            quickAddDetails.classList.add('active');
        });
        
        // Hide quick add details when clicking outside
        document.addEventListener('click', (e) => {
            if (!quickAddCard.contains(e.target) && taskTitleInput.value.trim() === '') {
                quickAddDetails.classList.remove('active');
            }
        });
    }

    // --- Local Storage Helpers ---
    function saveState() {
        localStorage.setItem('zt_tasks', JSON.stringify(state.tasks));
        localStorage.setItem('zt_workspaces', JSON.stringify(state.workspaces));
        localStorage.setItem('zt_active_workspace', state.activeWorkspace);
        localStorage.setItem('zt_streak', state.streak.toString());
        if (state.lastCompletionDate) {
            localStorage.setItem('zt_last_completion_date', state.lastCompletionDate);
        }
        updateStats();
    }

    // --- Productivity Statistics Dashboard ---
    function updateStats() {
        const workspaceTasks = state.tasks.filter(t => t.workspaceId === state.activeWorkspace);
        const total = workspaceTasks.length;
        const completed = workspaceTasks.filter(t => t.completed).length;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

        // Update progress bar
        taskCountText.textContent = `${completed} of ${total} tasks completed`;
        progressPercentText.textContent = `${percent}%`;
        progressBarFill.style.width = `${percent}%`;

        // Update Sidebar Stats
        statStreak.textContent = state.streak;

        // Tasks Completed Today
        const todayStr = new Date().toDateString();
        const completedToday = state.tasks.filter(t => {
            if (!t.completed || !t.completedAt) return false;
            return new Date(t.completedAt).toDateString() === todayStr;
        }).length;
        statTodayDone.textContent = completedToday;

        // Tasks Completed this Week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const completedThisWeek = state.tasks.filter(t => {
            if (!t.completed || !t.completedAt) return false;
            return new Date(t.completedAt) >= oneWeekAgo;
        }).length;
        statWeekDone.textContent = completedThisWeek;

        // Sidebar Navigation Counts
        const now = new Date();
        document.getElementById('nav-count-all').textContent = workspaceTasks.filter(t => !t.completed).length;
        
        document.getElementById('nav-count-today').textContent = workspaceTasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            return new Date(t.dueDate).toDateString() === now.toDateString();
        }).length;

        document.getElementById('nav-count-upcoming').textContent = workspaceTasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            return new Date(t.dueDate) > now;
        }).length;

        document.getElementById('nav-count-overdue').textContent = workspaceTasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            return new Date(t.dueDate) < now;
        }).length;

        document.getElementById('nav-count-completed').textContent = workspaceTasks.filter(t => t.completed).length;
    }

    // --- Streak Tracker ---
    function updateStreakOnCompletion() {
        const today = new Date();
        const todayStr = today.toDateString();

        if (state.lastCompletionDate === todayStr) {
            return; // Already completed a task today, streak is preserved
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (state.lastCompletionDate === yesterdayStr) {
            state.streak += 1;
        } else if (state.lastCompletionDate === null || state.streak === 0) {
            state.streak = 1;
        } else {
            // Streak broken
            state.streak = 1;
        }

        state.lastCompletionDate = todayStr;
        saveState();
    }

    // --- Workspace Management ---
    function renderWorkspaces() {
        workspaceSelect.innerHTML = '';
        state.workspaces.forEach(w => {
            const option = document.createElement('option');
            option.value = w.id;
            option.textContent = w.name;
            if (w.id === state.activeWorkspace) option.selected = true;
            workspaceSelect.appendChild(option);
        });
    }

    addWorkspaceBtn.addEventListener('click', () => {
        const name = prompt('Enter name for the new Workspace:');
        if (name && name.trim()) {
            const id = 'ws_' + Date.now();
            state.workspaces.push({ id, name: name.trim() });
            state.activeWorkspace = id;
            saveState();
            renderWorkspaces();
            renderTasks();
        }
    });

    workspaceSelect.addEventListener('change', (e) => {
        state.activeWorkspace = e.target.value;
        saveState();
        renderTasks();
    });

    // --- Category Management ---
    function renderCategories() {
        categoryListContainer.innerHTML = '';
        const defaultCategories = [
            { name: 'General', color: '#94a3b8' },
            { name: 'Work', color: '#6366f1' },
            { name: 'Personal', color: '#ec4899' },
            { name: 'Study', color: '#10b981' },
            { name: 'Fitness', color: '#f59e0b' },
            { name: 'Finance', color: '#06b6d4' }
        ];

        defaultCategories.forEach(cat => {
            const item = document.createElement('div');
            item.className = `category-item ${state.activeCategory === cat.name ? 'active' : ''}`;
            
            const count = state.tasks.filter(t => t.workspaceId === state.activeWorkspace && t.category === cat.name && !t.completed).length;

            item.innerHTML = `
                <div class="category-item-left">
                    <span class="category-color" style="background-color: ${cat.color}"></span>
                    <span>${cat.name}</span>
                </div>
                <span class="nav-count">${count}</span>
            `;

            item.addEventListener('click', () => {
                if (state.activeCategory === cat.name) {
                    state.activeCategory = null;
                } else {
                    state.activeCategory = cat.name;
                }
                renderCategories();
                renderTasks();
            });

            categoryListContainer.appendChild(item);
        });
    }

    // --- Task Actions: Add, Toggle, Edit, Delete ---
    function addTask() {
        const title = taskTitleInput.value.trim();
        if (!title) {
            taskTitleInput.focus();
            return;
        }

        const tagsArray = taskTags.value.split(',')
            .map(t => t.trim())
            .filter(t => t !== '');

        const newTask = {
            id: 'task_' + Date.now(),
            workspaceId: state.activeWorkspace,
            title: title,
            description: taskDescInput.value.trim(),
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            priority: taskPriority.value,
            category: taskCategory.value,
            dueDate: taskDue.value || null,
            tags: tagsArray,
            color: taskColor.value,
            recurrence: taskRecurrence.value,
            notes: '',
            attachments: [],
            subtasks: []
        };

        state.tasks.unshift(newTask);
        saveState();
        
        // Reset Inputs
        taskTitleInput.value = '';
        taskDescInput.value = '';
        taskDue.value = '';
        taskTags.value = '';
        taskRecurrence.value = 'none';
        
        // Hide details card
        quickAddDetails.classList.remove('active');
        
        renderCategories();
        renderTasks();

        // Canvas Confetti on nice success
        triggerConfetti(0.15);
    }

    function toggleTask(id) {
        state.tasks = state.tasks.map(t => {
            if (t.id === id) {
                const completed = !t.completed;
                let completedAt = completed ? new Date().toISOString() : null;
                
                // Recurrence handling
                if (completed && t.recurrence && t.recurrence !== 'none') {
                    handleRecurringTask(t);
                }

                if (completed) {
                    updateStreakOnCompletion();
                    triggerConfetti();
                }

                return { ...t, completed, completedAt };
            }
            return t;
        });

        saveState();
        renderCategories();
        renderTasks();
    }

    function handleRecurringTask(task) {
        const nextDue = new Date(task.dueDate || new Date());
        
        if (task.recurrence === 'daily') {
            nextDue.setDate(nextDue.getDate() + 1);
        } else if (task.recurrence === 'weekly') {
            nextDue.setDate(nextDue.getDate() + 7);
        } else if (task.recurrence === 'monthly') {
            nextDue.setMonth(nextDue.getMonth() + 1);
        }

        const recurringTask = {
            ...task,
            id: 'task_' + Date.now() + '_recur',
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            dueDate: nextDue.toISOString().slice(0, 16) // format for datetime-local
        };

        state.tasks.push(recurringTask);
    }

    function deleteTask(id) {
        const taskToDelete = state.tasks.find(t => t.id === id);
        if (!taskToDelete) return;

        // Buffer for Undo
        state.deletedTaskBuffer = taskToDelete;
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveState();
        renderCategories();
        renderTasks();
        
        // Show Undo Snackbar
        showUndoSnackbar();
    }

    function showUndoSnackbar() {
        if (state.undoTimeoutId) clearTimeout(state.undoTimeoutId);
        undoSnackbar.classList.remove('hidden');
        
        state.undoTimeoutId = setTimeout(() => {
            undoSnackbar.classList.add('hidden');
            state.deletedTaskBuffer = null;
        }, 5000); // 5 seconds to undo
    }

    undoBtn.addEventListener('click', () => {
        if (state.deletedTaskBuffer) {
            state.tasks.push(state.deletedTaskBuffer);
            state.deletedTaskBuffer = null;
            saveState();
            renderCategories();
            renderTasks();
            undoSnackbar.classList.add('hidden');
        }
    });

    bulkDeleteBtn.addEventListener('click', () => {
        const initialCount = state.tasks.length;
        state.tasks = state.tasks.filter(t => !(t.workspaceId === state.activeWorkspace && t.completed));
        if (state.tasks.length !== initialCount) {
            saveState();
            renderCategories();
            renderTasks();
        }
    });

    // --- Modal Task Editor ---
    function openEditModal(task) {
        state.editTaskId = task.id;
        editTitle.value = task.title;
        editDescription.value = task.description || '';
        editPriority.value = task.priority;
        editCategory.value = task.category;
        editDue.value = task.dueDate || '';
        editRecurrence.value = task.recurrence || 'none';
        editTags.value = task.tags ? task.tags.join(', ') : '';
        editColor.value = task.color || '#6366f1';
        editNotes.value = task.notes || '';
        
        currentAttachments = [...(task.attachments || [])];
        currentSubtasks = [...(task.subtasks || [])];
        
        renderModalAttachments();
        renderModalSubtasks();
        
        taskModal.classList.remove('hidden');
    }

    function closeModalWindow() {
        taskModal.classList.add('hidden');
        state.editTaskId = null;
    }

    function saveTaskEdits() {
        if (!state.editTaskId) return;
        const titleText = editTitle.value.trim();
        if (!titleText) return;

        const tagsArray = editTags.value.split(',')
            .map(t => t.trim())
            .filter(t => t !== '');

        state.tasks = state.tasks.map(t => {
            if (t.id === state.editTaskId) {
                return {
                    ...t,
                    title: titleText,
                    description: editDescription.value.trim(),
                    priority: editPriority.value,
                    category: editCategory.value,
                    dueDate: editDue.value || null,
                    recurrence: editRecurrence.value,
                    tags: tagsArray,
                    color: editColor.value,
                    notes: editNotes.value.trim(),
                    attachments: currentAttachments,
                    subtasks: currentSubtasks
                };
            }
            return t;
        });

        saveState();
        renderCategories();
        renderTasks();
        closeModalWindow();
    }

    // Modal Subtasks logic
    function renderModalSubtasks() {
        subtaskList.innerHTML = '';
        currentSubtasks.forEach((sub, index) => {
            const item = document.createElement('div');
            item.className = `subtask-item ${sub.completed ? 'completed' : ''}`;
            item.innerHTML = `
                <input type="checkbox" ${sub.completed ? 'checked' : ''}>
                <span class="subtask-title">${sub.title}</span>
                <button class="icon-btn-xs delete-subtask" data-index="${index}"><i data-lucide="trash-2"></i></button>
            `;
            
            item.querySelector('input').addEventListener('change', () => {
                currentSubtasks[index].completed = !currentSubtasks[index].completed;
                renderModalSubtasks();
            });

            item.querySelector('.delete-subtask').addEventListener('click', (e) => {
                e.stopPropagation();
                currentSubtasks.splice(index, 1);
                renderModalSubtasks();
            });

            subtaskList.appendChild(item);
        });
        if (window.lucide) lucide.createIcons();
    }

    addSubtaskBtn.addEventListener('click', () => {
        const text = subtaskInput.value.trim();
        if (text) {
            currentSubtasks.push({ title: text, completed: false });
            subtaskInput.value = '';
            renderModalSubtasks();
        }
    });

    subtaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const text = subtaskInput.value.trim();
            if (text) {
                currentSubtasks.push({ title: text, completed: false });
                subtaskInput.value = '';
                renderModalSubtasks();
            }
        }
    });

    // Modal Attachments logic
    function renderModalAttachments() {
        attachmentList.innerHTML = '';
        currentAttachments.forEach((name, index) => {
            const chip = document.createElement('div');
            chip.className = 'attachment-chip';
            chip.innerHTML = `
                <i data-lucide="file"></i>
                <span>${name}</span>
                <i data-lucide="x" class="attachment-chip-delete" data-index="${index}"></i>
            `;
            chip.querySelector('.attachment-chip-delete').addEventListener('click', () => {
                currentAttachments.splice(index, 1);
                renderModalAttachments();
            });
            attachmentList.appendChild(chip);
        });
        if (window.lucide) lucide.createIcons();
    }

    editAttachmentInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(f => {
            currentAttachments.push(f.name);
        });
        renderModalAttachments();
    });

    closeModal.addEventListener('click', closeModalWindow);
    cancelEditBtn.addEventListener('click', closeModalWindow);
    saveEditBtn.addEventListener('click', saveTaskEdits);

    // --- Search, Filter & Sort Logic ---
    function renderTasks() {
        let filtered = state.tasks.filter(t => t.workspaceId === state.activeWorkspace);

        // Sidebar Navigation view filters
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        if (state.currentView === 'today') {
            viewTitle.textContent = "Today's Tasks";
            filtered = filtered.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate);
                return d >= startOfToday && d <= endOfToday;
            });
        } else if (state.currentView === 'upcoming') {
            viewTitle.textContent = "Upcoming Tasks";
            filtered = filtered.filter(t => {
                if (!t.dueDate) return false;
                return new Date(t.dueDate) > endOfToday;
            });
        } else if (state.currentView === 'overdue') {
            viewTitle.textContent = "Overdue Tasks";
            filtered = filtered.filter(t => {
                if (!t.dueDate || t.completed) return false;
                return new Date(t.dueDate) < now;
            });
        } else if (state.currentView === 'completed') {
            viewTitle.textContent = "Completed Tasks";
            filtered = filtered.filter(t => t.completed);
        } else {
            viewTitle.textContent = "All Tasks";
        }

        // Toolbar Sub-filters
        if (state.currentFilter === 'pending') {
            filtered = filtered.filter(t => !t.completed);
        } else if (state.currentFilter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        } else if (state.currentFilter === 'high') {
            filtered = filtered.filter(t => t.priority === 'high');
        } else if (state.currentFilter === 'critical') {
            filtered = filtered.filter(t => t.priority === 'critical');
        }

        // Active Category Filter
        if (state.activeCategory) {
            filtered = filtered.filter(t => t.category === state.activeCategory);
        }

        // Active Search Filter
        if (state.searchQuery) {
            filtered = filtered.filter(t => 
                t.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                (t.description && t.description.toLowerCase().includes(state.searchQuery.toLowerCase()))
            );
        }

        // Sorting
        filtered.sort((a, b) => {
            if (state.sortBy === 'created-desc') {
                return new Date(b.createdAt) - new Date(a.createdAt);
            } else if (state.sortBy === 'created-asc') {
                return new Date(a.createdAt) - new Date(b.createdAt);
            } else if (state.sortBy === 'due-asc') {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            } else if (state.sortBy === 'due-desc') {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(b.dueDate) - new Date(a.dueDate);
            } else if (state.sortBy === 'priority-desc') {
                const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
                return priorityWeight[b.priority] - priorityWeight[a.priority];
            } else if (state.sortBy === 'priority-asc') {
                const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
                return priorityWeight[a.priority] - priorityWeight[b.priority];
            } else if (state.sortBy === 'alpha-asc') {
                return a.title.localeCompare(b.title);
            } else if (state.sortBy === 'alpha-desc') {
                return b.title.localeCompare(a.title);
            }
            return 0;
        });

        // UI rendering
        taskList.innerHTML = '';
        if (filtered.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            emptyState.style.display = 'none';
            filtered.forEach(task => {
                const card = createTaskCard(task);
                taskList.appendChild(card);
            });
        }
        
        if (window.lucide) lucide.createIcons();
    }

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card ${task.completed ? 'completed' : ''}`;
        card.setAttribute('data-id', task.id);
        card.setAttribute('draggable', 'true');

        // Color indicator bar
        const colorBar = document.createElement('div');
        colorBar.className = 'color-bar-indicator';
        colorBar.style.backgroundColor = task.color || '#6366f1';
        card.appendChild(colorBar);

        // Drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'task-drag-handle';
        dragHandle.innerHTML = '<i data-lucide="grip-vertical"></i>';
        card.appendChild(dragHandle);

        // Custom priority class for checkbox
        const checkboxContainer = document.createElement('label');
        checkboxContainer.className = `checkbox-container p-${task.priority}`;
        checkboxContainer.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''}>
            <span class="checkmark"></span>
        `;
        checkboxContainer.querySelector('input').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTask(task.id);
        });
        card.appendChild(checkboxContainer);

        // Task content details
        const content = document.createElement('div');
        content.className = 'task-card-content';
        
        // Title row
        const titleRow = document.createElement('div');
        titleRow.className = 'task-card-title-row';
        titleRow.innerHTML = `<span class="task-title">${task.title}</span>`;
        content.appendChild(titleRow);

        // Description
        if (task.description) {
            const desc = document.createElement('p');
            desc.className = 'task-card-desc';
            desc.textContent = task.description;
            content.appendChild(desc);
        }

        // Meta indicators
        const metaRow = document.createElement('div');
        metaRow.className = 'task-card-meta';

        // Category Badge
        const catBadge = document.createElement('span');
        catBadge.className = `badge badge-tag`;
        catBadge.textContent = task.category;
        metaRow.appendChild(catBadge);

        // Priority Badge
        const pBadge = document.createElement('span');
        pBadge.className = `badge badge-priority badge-p-${task.priority}`;
        pBadge.textContent = task.priority;
        metaRow.appendChild(pBadge);

        // Recurrence indicator
        if (task.recurrence && task.recurrence !== 'none') {
            const recBadge = document.createElement('span');
            recBadge.className = 'badge badge-recur';
            recBadge.innerHTML = `<i data-lucide="refresh-cw"></i> ${task.recurrence}`;
            metaRow.appendChild(recBadge);
        }

        // Subtasks progress indicator
        if (task.subtasks && task.subtasks.length > 0) {
            const subCount = task.subtasks.length;
            const subDone = task.subtasks.filter(s => s.completed).length;
            const subBadge = document.createElement('span');
            subBadge.className = 'badge badge-subtask-progress';
            subBadge.innerHTML = `<i data-lucide="list-todo"></i> ${subDone}/${subCount}`;
            metaRow.appendChild(subBadge);
        }

        // Due date indicator
        if (task.dueDate) {
            const dueBadge = document.createElement('span');
            const d = new Date(task.dueDate);
            const isOverdue = d < new Date() && !task.completed;
            dueBadge.className = `due-badge ${isOverdue ? 'overdue' : ''}`;
            
            const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            dueBadge.innerHTML = `<i data-lucide="calendar"></i> ${d.toLocaleDateString(undefined, options)}`;
            metaRow.appendChild(dueBadge);
        }

        content.appendChild(metaRow);
        card.appendChild(content);

        // Action Buttons inside Card
        const actions = document.createElement('div');
        actions.className = 'task-card-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn-sm danger-text';
        deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        deleteBtn.setAttribute('title', 'Delete Task');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        });

        actions.appendChild(deleteBtn);
        card.appendChild(actions);

        // Clicking card opens full modal edit window
        card.addEventListener('click', () => {
            openEditModal(task);
        });

        // Setup Drag & Drop Handlers on card
        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        return card;
    }

    // --- Drag and Drop Task Reordering ---
    taskList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (!dragging) return;

        const siblings = [...taskList.querySelectorAll('.task-card:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const box = sibling.getBoundingClientRect();
            return e.clientY <= box.top + box.height / 2;
        });

        if (nextSibling) {
            taskList.insertBefore(dragging, nextSibling);
        } else {
            taskList.appendChild(dragging);
        }
    });

    taskList.addEventListener('drop', () => {
        // Collect current DOM ordering
        const reorderedIds = [...taskList.querySelectorAll('.task-card')].map(card => card.getAttribute('data-id'));
        
        // Re-construct the state tasks arrays
        const otherWorkspaceTasks = state.tasks.filter(t => t.workspaceId !== state.activeWorkspace);
        const thisWorkspaceTasks = reorderedIds.map(id => state.tasks.find(t => t.id === id));

        state.tasks = [...thisWorkspaceTasks, ...otherWorkspaceTasks];
        saveState();
    });

    // --- Voice Input Web Speech API ---
    function startVoiceInput() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Web Speech API is not supported in this browser. Please try Google Chrome.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        voiceBtn.classList.add('active');
        voiceBtn.style.color = '#ef4444';

        recognition.onstart = () => {
            taskTitleInput.placeholder = "Listening...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            taskTitleInput.value = transcript;
            taskTitleInput.placeholder = "Add a new task...";
            quickAddDetails.classList.add('active');
            taskTitleInput.focus();
        };

        recognition.onerror = () => {
            voiceBtn.classList.remove('active');
            voiceBtn.style.color = '';
            taskTitleInput.placeholder = "Add a new task...";
        };

        recognition.onend = () => {
            voiceBtn.classList.remove('active');
            voiceBtn.style.color = '';
        };

        recognition.start();
    }

    // --- Notifications & Reminders ---
    function requestNotificationPermission() {
        if ("Notification" in window) {
            if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        }
    }

    function checkDeadlinesPeriodically() {
        setInterval(() => {
            const now = new Date();
            state.tasks.forEach(task => {
                if (task.dueDate && !task.completed && !task.notified) {
                    const dueTime = new Date(task.dueDate);
                    const timeDiff = dueTime - now;

                    // Notify if task is within the next 15 minutes
                    if (timeDiff > 0 && timeDiff <= 15 * 60 * 1000) {
                        showDeadlineNotification(task);
                        task.notified = true; // Avoid double triggering
                        saveState();
                    }
                }
            });
        }, 60 * 1000); // Check once every minute
    }

    function showDeadlineNotification(task) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("ZenTask Reminder!", {
                body: `Your task "${task.title}" is due soon!`,
                icon: "https://unpkg.com/lucide-static@0.221.0/icons/zap.svg"
            });
        }
    }

    // --- Import / Export ---
    function exportTasks() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.tasks, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `zentasks_pro_export_${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function triggerImport() {
        importFileInput.click();
    }

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (Array.isArray(parsed)) {
                    state.tasks = parsed;
                    saveState();
                    renderCategories();
                    renderTasks();
                    alert("Tasks successfully imported!");
                } else {
                    alert("Error: File is not a valid list of tasks.");
                }
            } catch (err) {
                alert("Error: Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);
    });

    // --- Theme Management ---
    function setupTheme() {
        const savedTheme = localStorage.getItem('zt_theme') || 'dark';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            themeIconSun.classList.add('hidden');
            themeIconMoon.classList.remove('hidden');
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            themeIconSun.classList.remove('hidden');
            themeIconMoon.classList.add('hidden');
        }
        localStorage.setItem('zt_theme', theme);
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        applyTheme(isDark ? 'light' : 'dark');
    });

    // --- Confetti Success Visual FX ---
    function triggerConfetti(density = 0.25) {
        confetti({
            particleCount: Math.round(150 * density),
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#a855f7', '#ec4899']
        });
    }

    // --- Events Bindings ---
    addTaskBtn.addEventListener('click', addTask);
    taskTitleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // Voice setup
    voiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startVoiceInput();
    });

    // Sidebar navigation togglers
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            state.currentView = item.getAttribute('data-view');
            renderTasks();
            
            // Auto close sidebar on mobile views
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        });
    });

    // Filters pills
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            state.currentFilter = pill.getAttribute('data-filter');
            renderTasks();
        });
    });

    // Sort Dropdown
    sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderTasks();
    });

    // Instant searching
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderTasks();
    });

    // Sidebar controllers
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
    });

    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });

    // Export / Import binds
    exportBtn.addEventListener('click', exportTasks);
    importBtn.addEventListener('click', triggerImport);

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput && document.activeElement !== taskTitleInput && document.activeElement !== editTitle && document.activeElement !== editDescription) {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'Escape') {
            closeModalWindow();
        }
    });

    // FAB mobile behaviour
    fabAdd.addEventListener('click', () => {
        taskTitleInput.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Let's go!
    init();
});
