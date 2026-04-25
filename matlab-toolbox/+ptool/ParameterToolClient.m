classdef ParameterToolClient < handle
    %PARAMETERTOOLCLIENT Typed REST client for the Engineering Tool.
    %   Wraps the parameter-store endpoints so MATLAB code can push,
    %   pull, and sync parameters without dealing with HTTP headers,
    %   pagination, or provenance bookkeeping by hand.
    %
    %   Example:
    %       c = ptool.ParameterToolClient( ...
    %           'https://app.example.com/api/v1', ...
    %           'mcp_<token>', ...
    %           'PROJECT-UUID');
    %       tbl = c.list();      % returns table of parameters
    %       c.create(struct('name','v_bus','dataType','float','defaultValue','28','unit','V'));
    %       c.push(struct('i_max', 12.5, 'soc_min', 20));

    properties (SetAccess = immutable)
        BaseUrl     (1,1) string
        ProjectId   (1,1) string
    end

    properties (Access = private)
        Token (1,1) string
    end

    methods
        function obj = ParameterToolClient(baseUrl, token, projectId)
            arguments
                baseUrl   (1,1) string
                token     (1,1) string
                projectId (1,1) string
            end
            obj.BaseUrl   = strip(baseUrl, 'right', '/');
            obj.Token     = token;
            obj.ProjectId = projectId;
        end

        function tbl = list(obj, opts)
            %LIST Page through parameters and return a MATLAB table.
            arguments
                obj
                opts.PageSize (1,1) double {mustBePositive} = 200
                opts.Q        string = ""
                opts.Status   string = ""
            end
            page = 1;
            rows = {};
            while true
                qs = sprintf('?page=%d&pageSize=%d', page, opts.PageSize);
                if strlength(opts.Q) > 0
                    qs = [qs '&q=' urlencode(char(opts.Q))]; %#ok<AGROW>
                end
                if strlength(opts.Status) > 0
                    qs = [qs '&status=' urlencode(char(opts.Status))]; %#ok<AGROW>
                end
                resp = obj.request("GET", "/parameters/" + obj.ProjectId + string(qs));
                if ~isfield(resp, 'success') || ~resp.success
                    error('ptool:listFailed', 'list call failed');
                end
                if ~isempty(resp.data)
                    rows{end+1} = struct2table(resp.data, 'AsArray', true); %#ok<AGROW>
                end
                if numel(resp.data) < opts.PageSize
                    break;
                end
                page = page + 1;
            end
            if isempty(rows)
                tbl = table();
            else
                tbl = vertcat(rows{:});
            end
        end

        function row = get(obj, idOrName)
            %GET Fetch one parameter by id or by exact name.
            arguments
                obj
                idOrName (1,1) string
            end
            resp = obj.request("GET", ...
                "/parameters/" + obj.ProjectId + "?q=" + urlencode(char(idOrName)) + "&pageSize=1");
            if ~resp.success || isempty(resp.data)
                error('ptool:notFound', 'Parameter %s not found', idOrName);
            end
            row = resp.data(1);
        end

        function created = create(obj, payload)
            %CREATE POST a new parameter. Provenance auto-attached.
            arguments
                obj
                payload (1,1) struct
            end
            payload.source = "matlab";
            payload.matlabVersion = string(version('-release'));
            payload.hostname = string(getHostname());
            resp = obj.request("POST", "/parameters/" + obj.ProjectId, payload);
            if ~resp.success
                error('ptool:createFailed', 'create failed: %s', char(resp.error));
            end
            created = resp.data;
        end

        function updated = update(obj, id, payload)
            arguments
                obj
                id      (1,1) string
                payload (1,1) struct
            end
            resp = obj.request("PUT", ...
                "/parameters/" + obj.ProjectId + "/" + id, payload);
            if ~resp.success
                error('ptool:updateFailed', 'update failed: %s', char(resp.error));
            end
            updated = resp.data;
        end

        function n = push(obj, ws)
            %PUSH Workspace -> server. ws is a struct of name -> value.
            arguments
                obj
                ws (1,1) struct
            end
            n = 0;
            names = fieldnames(ws);
            for k = 1:numel(names)
                name = names{k};
                value = ws.(name);
                payload = struct( ...
                    'name', name, ...
                    'dataType', ptool.classToDataType(class(value)), ...
                    'defaultValue', ptool.valueToString(value), ...
                    'status', 'draft');
                obj.create(payload);
                n = n + 1;
            end
        end

        function ws = pull(obj)
            tbl = obj.list();
            ws = struct();
            if isempty(tbl)
                return;
            end
            for k = 1:height(tbl)
                ws.(string(tbl.name(k))) = ptool.stringToValue( ...
                    string(tbl.defaultValue(k)), string(tbl.dataType(k)));
            end
        end
    end

    methods (Access = private)
        function out = request(obj, method, path, body)
            arguments
                obj
                method (1,1) string
                path   (1,1) string
                body   = []
            end
            url = char(obj.BaseUrl + path);
            opts = weboptions( ...
                'HeaderFields', { ...
                    'Authorization', char("Bearer " + obj.Token); ...
                    'Content-Type',  'application/json'}, ...
                'RequestMethod', char(method), ...
                'MediaType',     'application/json', ...
                'Timeout',       60);
            try
                if isempty(body)
                    raw = webread(url, opts);
                else
                    raw = webwrite(url, body, opts);
                end
                out = raw;
            catch ME
                out = struct('success', false, 'error', string(ME.message));
            end
        end
    end
end

function h = getHostname()
    [~, h] = system('hostname');
    h = strtrim(h);
end
