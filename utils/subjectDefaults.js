// Predefined subjects per academic year
const DEFAULT_SUBJECTS = {
    SY: [
        { name: 'DSA', code: 'SY-DSA' },
        { name: 'OOP', code: 'SY-OOP' },
        { name: 'DBMS', code: 'SY-DBMS' },
        { name: 'COA', code: 'SY-COA' },
        { name: 'Mathematics', code: 'SY-MATH' },
        { name: 'Python', code: 'SY-PY' },
    ],
    TY: [
        { name: 'Web Development', code: 'TY-WD' },
        { name: 'Operating System', code: 'TY-OS' },
        { name: 'Computer Networks', code: 'TY-CN' },
        { name: 'Software Engineering', code: 'TY-SE' },
        { name: 'AI', code: 'TY-AI' },
        { name: 'Data Analytics', code: 'TY-DA' },
    ],
    LY: [
        { name: 'Cloud Computing', code: 'LY-CC' },
        { name: 'Machine Learning', code: 'LY-ML' },
        { name: 'Cyber Security', code: 'LY-CS' },
        { name: 'Big Data', code: 'LY-BD' },
        { name: 'Project Work', code: 'LY-PW' },
    ],
}

// Base material categories available for ALL subjects
const BASE_CATEGORIES = [
    { value: 'notes', label: 'Notes' },
    { value: 'lab_manual', label: 'Lab Manual' },
    { value: 'question_bank', label: 'Question Bank' },
    { value: 'ppt', label: 'PPT / Slides' },
    { value: 'previous_papers', label: 'Previous Papers' },
]

// Extra categories only for Web Development subject
const WEB_DEV_EXTRA_CATEGORIES = [
    { value: 'html_notes', label: 'HTML Notes' },
    { value: 'css_notes', label: 'CSS Notes' },
    { value: 'js_notes', label: 'JS Notes' },
    { value: 'react_notes', label: 'React Notes' },
    { value: 'mini_projects', label: 'Mini Projects' },
]

// All possible category values for enum validation
const ALL_CATEGORY_VALUES = [
    ...BASE_CATEGORIES.map((c) => c.value),
    ...WEB_DEV_EXTRA_CATEGORIES.map((c) => c.value),
]

// The name of the subject that gets extra categories
const WEB_DEV_SUBJECT_NAME = 'Web Development'

/**
 * Returns material categories available for a given subject name
 */
const getCategoriesForSubject = (subjectName) => {
    if (subjectName === WEB_DEV_SUBJECT_NAME) {
        return [...BASE_CATEGORIES, ...WEB_DEV_EXTRA_CATEGORIES]
    }
    return BASE_CATEGORIES
}

module.exports = {
    DEFAULT_SUBJECTS,
    BASE_CATEGORIES,
    WEB_DEV_EXTRA_CATEGORIES,
    ALL_CATEGORY_VALUES,
    WEB_DEV_SUBJECT_NAME,
    getCategoriesForSubject,
}
