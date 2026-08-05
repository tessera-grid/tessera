import { Box, Button, Grid } from './_shims'

export interface BatchToolbarProps {
  disabled: boolean
  onSelect: () => void
  isAllRowsSelected: boolean
  selectedDataCount: number
}

export const BatchToolbar = ({
  disabled,
  onSelect,
  isAllRowsSelected,
  selectedDataCount,
}: BatchToolbarProps) => {
  return (
    <Grid container wrap="nowrap" style={{ paddingBottom: 16 }}>
      <Grid container item alignItems="center" style={{ gap: 8 }}>
        <Box>Здесь должен быть тулбар массовых действий</Box>
      </Grid>
      <Grid
        container
        item
        alignItems="center"
        justify="flex-end"
        style={{ gap: 8 }}
      >
        <Button
          squared
          filled
          size="small"
          fullWidth={false}
          disabled={disabled}
          onClick={onSelect}
        >
          {isAllRowsSelected
            ? `Выбрано: ${selectedDataCount} записей`
            : 'Выбрать все'}
        </Button>
      </Grid>
    </Grid>
  )
}
