interface FormInputProps {
  label: string;
  name: string;
  value: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
  onChange: (name: string, value: string) => void;
}

const FormInput = ({
  label,
  name,
  value,
  type = "text",
  required = false,
  placeholder,
  min,
  onChange,
}: FormInputProps) => {
  return (
    <label className="field">
      <span>{label}{required && " *"}</span>
      <input
        name={name}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        min={min}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
};

export default FormInput;
