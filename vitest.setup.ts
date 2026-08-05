import { setProjectAnnotations } from '@storybook/react-vite'

import preview from './.storybook/preview'

// Wire the Storybook preview annotations into portable stories so
// composeStories() renders them exactly as Storybook does.
setProjectAnnotations([preview])
