import axios from "axios";

const baseURL =
    import.meta.env.VITE_API_BASE_URL ||
    "https://api-doc-vl.azurewebsites.net";

const api = axios.create({ baseURL });

export default api;