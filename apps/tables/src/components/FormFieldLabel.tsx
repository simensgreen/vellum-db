export function FormFieldLabel({
  children,
  required = false,
}: {
  children: string;
  required?: boolean;
}) {
  return (
    <span class="form-field__label">
      {children}
      {required ? <span class="form-field__required">*</span> : null}
    </span>
  );
}
