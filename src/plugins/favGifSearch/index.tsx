/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./tagColors.css";

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { DeleteIcon } from "@components/Icons";
import { copyToClipboard } from "@utils/clipboard";
import { Devs } from "@utils/constants";
import { ModalContent, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { SelectOption } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { Button, Card, ContextMenuApi, Forms, Menu, React, SearchableSelect, Select, Switch, TextArea, TextInput, useCallback, useEffect, useRef, useState } from "@webpack/common";

interface SearchBarComponentProps {
    ref?: React.MutableRefObject<any>;
    autoFocus: boolean;
    className: string;
    size: string;
    onChange: (query: string) => void;
    onClear: () => void;
    query: string;
    placeholder: string;
}

type TSearchBarComponent =
    React.FC<SearchBarComponentProps>;

interface Gif {
    format: number;
    src: string;
    width: number;
    height: number;
    order: number;
    url: string;
}

interface Instance {
    dead?: boolean;
    state: {
        resultType?: string;
    };
    props: {
        favCopy: Gif[],

        favorites: Gif[],
    },
    forceUpdate: () => void;
}

interface GIFButtonProps {
    item: Gif;
    index: number;
    format: number;
    src: string;
    coords: {
        position: string;
        left: number;
        width: number;
        top: number;
        height: number;
    };
    focused: boolean;
}

interface GIFButtonInstance {
    props: GIFButtonProps;
}

const tagCategories = ["general", "artist", "character", "metadata", "copyright"] as const;
type TagCategory = typeof tagCategories[number];

interface GIFTag {
    name: string;
    notes: string;
    alternateNames: string[];
    category: TagCategory;
}

const containerClasses: { searchBar: string; } = findByPropsLazy("searchBar", "searchBarFullRow");

const cl = classNameFactory("vc-fav-gif-search-");
var gifTags: Array<GIFTag> = [];
var tags = new Map<string, string[]>();

export const settings = definePluginSettings({
    searchOption: {
        type: OptionType.SELECT,
        description: "The part of the url you want to search",
        options: [
            {
                label: "Entire Url",
                value: "url"
            },
            {
                label: "Path Only (/somegif.gif)",
                value: "path"
            },
            {
                label: "Host & Path (tenor.com somgif.gif)",
                value: "hostandpath",
                default: true
            },
            {
                label: "Tags (fallbacks to host & path if no results found)",
                value: "tags",
                default: false
            }
        ] as const
    },
});

export default definePlugin({
    name: "FavoriteGifSearch",
    authors: [Devs.Aria, { name: "int4_t", id: 723437187428778015n, }],
    description: "Adds a search bar to favorite gifs.",

    patches: [
        {
            find: "renderHeaderContent()",
            replacement: [
                {
                    // https://regex101.com/r/07gpzP/1
                    // ($1 renderHeaderContent=function { ... switch (x) ... case FAVORITES:return) ($2) ($3 case default:return r.jsx(($<searchComp>), {...props}))
                    match: /(renderHeaderContent\(\).{1,150}FAVORITES:return)(.{1,150});(case.{1,200}default:return\(0,\i\.jsx\)\((?<searchComp>\i\..{1,10}),)/,
                    replace: "$1 this.state.resultType === 'Favorites' ? $self.renderSearchBar(this, $<searchComp>) : $2;$3"
                },
                {
                    // to persist filtered favorites when component re-renders.
                    // when resizing the window the component rerenders and we loose the filtered favorites and have to type in the search bar to get them again
                    match: /(,suggestions:\i,favorites:)(\i),/,
                    replace: "$1$self.getFav($2),favCopy:$2,"
                }
            ]
        },
        {
            find: /renderGIF\(\)\{.{1,200}render\(\)\{.{1,400}\}\)/,
            replacement: [
                {
                    // https://regex101.com/r/zWeAfs/2
                    match: /(render\(\)\{.{1,400})(\}\))/,
                    replace: "$1,onContextMenu:(ev)=>$self.openContextMenu(this, ev),$2"
                }
            ]
        }
    ],

    settings,

    getTargetString,

    instance: null as Instance | null,
    searchBarComponent: null as TSearchBarComponent | null,
    renderSearchBar(instance: Instance, SearchBarComponent: TSearchBarComponent) {
        this.instance = instance;
        this.searchBarComponent = SearchBarComponent;

        return (
            <ErrorBoundary noop>
                <Header instance={instance} SearchBarComponent={SearchBarComponent} />
            </ErrorBoundary>
        );
    },

    openContextMenu(instance: GIFButtonInstance, ev: React.UIEvent) {
        if (this.searchBarComponent == null) return;

        ContextMenuApi.openContextMenu(ev, () => (<GIFContextMenu item={instance.props.item} SearchBarComponent={this.searchBarComponent!} />));
    },

    getFav(favorites: Gif[]) {
        if (!this.instance || this.instance.dead) return favorites;
        const { favorites: filteredFavorites } = this.instance.props;

        return filteredFavorites != null && filteredFavorites?.length !== favorites.length ? filteredFavorites : favorites;
    },

    async start() {
        gifTags = await DataStore.get(cl("gif-tags")) ?? [];
        tags = await DataStore.get(cl("tags")) ?? new Map();
    }
});

function Header({ instance, SearchBarComponent }: { instance: Instance; SearchBarComponent: TSearchBarComponent; }) {
    const [query, setQuery] = useState("");
    const ref = useRef<{ containerRef?: React.MutableRefObject<HTMLDivElement>; } | null>(null);

    const onChange = useCallback((searchQuery: string) => {
        setQuery(searchQuery);
        const { props } = instance;

        // return early
        if (searchQuery === "") {
            props.favorites = props.favCopy;
            instance.forceUpdate();
            return;
        }


        // scroll back to top
        ref.current?.containerRef?.current
            .closest("#gif-picker-tab-panel")
            ?.querySelector("[class|=\"content\"]")
            ?.firstElementChild?.scrollTo(0, 0);


        var tagSearch: Gif[] = [];
        if (settings.store.searchOption === "tags") {
            tagSearch = props.favCopy.filter(gif => matchesTags(searchQuery, tags.get(gif.url) ?? []));
        }

        if (tagSearch.length === 0) {
            const result =
                props.favCopy
                    .map(gif => ({
                        score: fuzzySearch(searchQuery.toLowerCase(), getTargetString(gif.url ?? gif.src).replace(/(%20|[_-])/g, " ").toLowerCase()),
                        gif,
                    }))
                    .filter(m => m.score != null) as { score: number; gif: Gif; }[];

            result.sort((a, b) => b.score - a.score);
            props.favorites = result.map(e => e.gif);
        } else {
            props.favorites = tagSearch;
        }

        instance.forceUpdate();
    }, [instance.state]);

    useEffect(() => {
        return () => {
            instance.dead = true;
        };
    }, []);

    return (
        <SearchBarComponent
            ref={ref}
            autoFocus={true}
            className={containerClasses.searchBar}
            size="md"
            onChange={onChange}
            onClear={() => {
                setQuery("");
                if (instance.props.favCopy != null) {
                    instance.props.favorites = instance.props.favCopy;
                    instance.forceUpdate();
                }
            }}
            query={query}
            placeholder="Search Favorite Gifs"
        />
    );
}

function SearchBarWithTags(props: SearchBarComponentProps & { SearchBarComponent: TSearchBarComponent; }) {
    const { onChange: propsOnChange, SearchBarComponent, ...rest } = props;
    const [query, setQuery] = useState("");

    const onChange = useCallback((searchQuery: string) => {
        setQuery(searchQuery);
        propsOnChange(searchQuery);
    }, [propsOnChange]);

    return (
        <div>
            <SearchBarComponent
                onChange={onChange}
                {...rest}
            />
        </div>
    );
}

function GIFContextMenu({ item, SearchBarComponent }: { item: Gif; SearchBarComponent: TSearchBarComponent; }) {
    const { url } = item;

    return (
        <Menu.Menu navId={cl("gif-context-menu")} onClose={ContextMenuApi.closeContextMenu} onSelect={() => { }}>
            {tags.get(url)?.sort(sortByCategory).map(tag => (
                <React.Fragment key={tag}>
                    <Menu.MenuItem id={cl(`tag-${tag}`)} label={tag} render={() => (
                        <span className={cl(`tag-${gifTags.find(t => t.name === tag)?.category}`)}>{tag}</span>
                    )} />
                </React.Fragment>
            ))}

            {(tags.get(url)?.length ?? 0) > 0 && (
                <Menu.MenuSeparator />
            )}

            <Menu.MenuItem id={cl("copy-gif-url")} label="Copy Gif URL" action={async () => {
                await copyToClipboard(url);
                ContextMenuApi.closeContextMenu();
            }} />

            <Menu.MenuItem
                id={cl("add-tag")}
                label="Add Tag"
                action={() =>
                    openModal(modalProps => (
                        <ModalRoot {...modalProps}>
                            <ModalContent>
                                <AddTagModal SearchBarComponent={SearchBarComponent} url={url} />
                            </ModalContent>
                        </ModalRoot>
                    ))
                } />

            <Menu.MenuItem id={cl("create-new-tag")} label="Create New Tag" action={() =>
                openModal(modalProps => (
                    <ModalRoot {...modalProps}>
                        <ModalContent>
                            <CreateNewTagModal url={url} />
                        </ModalContent>
                    </ModalRoot>
                ))
            } />
        </Menu.Menu>
    );
}

interface AddTagModalProps {
    SearchBarComponent: TSearchBarComponent;
    url: string;
}

function AddTagModal({ SearchBarComponent, url }: AddTagModalProps) {
    const [query, setQuery] = useState("");
    const [selectedTag, setSelectedTag] = useState<SelectOption | undefined>(undefined);
    const [currentTags, setCurrentTags] = useState<string[]>(tags.get(url) ?? []);
    const [tagSearchQuery, setTagSearchQuery] = useState("");

    useEffect(() => {
        tags.set(url, currentTags);
        DataStore.set(cl("tags"), tags);
    }, [currentTags]);

    return (
        <Flex flexDirection="column">
            <Forms.FormTitle tag="h2">Edit Tags</Forms.FormTitle>

            <Forms.FormSection title="Add New Tag">
                <div style={{ display: "flex", flexDirection: "row", justifyItems: "stretch", gap: "0.1em" }}>
                    <SearchableSelect
                        options={gifTags.filter(t => !isTagInCollection(t.name, currentTags)).map(t => t.name).sort(sortByCategory).map(t => ({ label: t, value: t }))}
                        value={selectedTag}
                        onSearchChange={setTagSearchQuery}
                        onChange={v => setSelectedTag(v)}
                    />
                    {selectedTag && (
                        <Button size={Button.Sizes.LARGE} color={Button.Colors.TRANSPARENT} onClick={() => {
                            setCurrentTags([...currentTags, selectedTag as any]);
                            setSelectedTag(undefined);
                        }}>Add Tag</Button>
                    )}
                </div>
            </Forms.FormSection>

            <Forms.FormSection>
                <SearchBarComponent
                    autoFocus={true}
                    className=""
                    onChange={setQuery}
                    query={query}
                    placeholder="Search for a tag"
                    size={SearchBarComponent.Sizes.MEDIUM}
                    onClear={() => setQuery("")}
                />
            </Forms.FormSection>

            {currentTags.sort(sortByCategory).map(tag => (
                <Card key={tag}>
                    <Flex style={{ justifyContent: "space-between", padding: "0.5em" }}>
                        <span className={cl(`tag-${gifTags.find(t => t.name === tag)?.category}`)}>{tag}</span>
                        <Button size={Button.Sizes.ICON} color={Button.Colors.RED} onClick={() => {
                            setCurrentTags(currentTags.filter(t => t !== tag));
                        }}><DeleteIcon /></Button>
                    </Flex>
                </Card>
            ))}
        </Flex>
    );
}

interface CreateNewTagModalProps {
    url: string;
}

function CreateNewTagModal({ url }: CreateNewTagModalProps) {
    const defaultTag: GIFTag = {
        name: "",
        notes: "",
        alternateNames: [],
        category: "general"
    };

    const [newTag, setNewTag] = useState<GIFTag>(defaultTag);
    const [currentGIFTags, setCurrentGIFTags] = useState<GIFTag[]>(gifTags);
    const [addToCurrentTags, setAddToCurrentTags] = useState<boolean>(true);

    useEffect(() => {
        gifTags = [...currentGIFTags];
        DataStore.set(cl("gif-tags"), gifTags);
    }, [currentGIFTags]);

    const errorName = newTag.name === "" || currentGIFTags.some(t => t.name === newTag.name) || newTag.name.split("_").some(part => part.startsWith("-"));
    const errorMessage = "Tag name cannot be empty, already exists, or contain spaces/special characters used in search queries";

    return (
        <div style={{ display: "flex", flexDirection: "row", gap: "0.2em", width: "100%" }}>
            <Forms.FormSection title="Create New Tag">
                <Flex flexDirection="column" style={{ marginTop: "1em", marginBottom: "1em" }}>
                    <Forms.FormSection title="Name">
                        <Forms.FormText>The unique identifier for your tag</Forms.FormText>
                        <TextInput
                            value={newTag.name}
                            onChange={e => setNewTag({ ...newTag, name: e.replace(/[- ]/g, "_").toLowerCase() })}
                            required={true}
                            error={errorName ? errorMessage : undefined}
                        />
                    </Forms.FormSection>

                    <Forms.FormSection title="Category">
                        <Forms.FormText>Tag classification</Forms.FormText>
                        <Select
                            options={tagCategories.map(c => ({ label: c, value: c }))}
                            select={v => setNewTag({ ...newTag, category: v })}
                            isSelected={v => newTag.category === v}
                            serialize={v => v}
                            clear={() => setNewTag({ ...newTag, category: "general" })}
                        />
                    </Forms.FormSection>

                    <Forms.FormSection title="Notes">
                        <Forms.FormText>Additional information about this tag's purpose</Forms.FormText>
                        <TextArea
                            value={newTag.notes}
                            onChange={e => setNewTag({ ...newTag, notes: e })}
                        />
                    </Forms.FormSection>

                    <Forms.FormSection title="Alternate Names">
                        <Forms.FormText>Comma separated list of alternative names for this tag</Forms.FormText>
                        <TextInput
                            value={newTag.alternateNames.join(", ")}
                            onChange={e => setNewTag({ ...newTag, alternateNames: e.split(",").map(name => name.trim()) })}
                            onBlur={e => setNewTag(prev => ({ ...prev, alternateNames: e.target.value.split(",").map(name => name.trim()).filter(Boolean) }))}
                            placeholder="tag1, tag2, tag3"
                        />
                    </Forms.FormSection>

                    <Forms.FormSection>
                        <Switch
                            value={addToCurrentTags}
                            onChange={v => setAddToCurrentTags(v)}
                        >
                            <Forms.FormText>Add to current tags</Forms.FormText>
                        </Switch>
                    </Forms.FormSection>

                    <Button onClick={() => {
                        if (errorName) {
                            return;
                        }

                        if (addToCurrentTags) {
                            tags.set(url, [...(tags.get(url) ?? []), newTag.name]);
                            DataStore.set(cl("tags"), tags);
                        }

                        setCurrentGIFTags([...currentGIFTags, newTag]);

                        setNewTag(defaultTag);
                    }}>Create GIF Tag</Button>
                </Flex>
            </Forms.FormSection>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5em", overflowY: "auto" }}>
                {currentGIFTags.map(tag => (
                    <Card key={tag.name} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5em" }}>
                        <span className={cl(`tag-${tag.category}`)}>{tag.name}</span>
                        <Button size={Button.Sizes.ICON} color={Button.Colors.RED} onClick={() => {
                            setCurrentGIFTags(currentGIFTags.filter(t => t.name !== tag.name));
                        }}><DeleteIcon /></Button>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export function getTargetString(urlStr: string) {
    let url: URL;
    try {
        url = new URL(urlStr);
    } catch (err) {
        // Can't resolve URL, return as-is
        return urlStr;
    }

    switch (settings.store.searchOption) {
        case "url":
            return url.href;
        case "path":
            if (url.host === "media.discordapp.net" || url.host === "tenor.com")
                // /attachments/899763415290097664/1095711736461537381/attachment-1.gif -> attachment-1.gif
                // /view/some-gif-hi-24248063 -> some-gif-hi-24248063
                return url.pathname.split("/").at(-1) ?? url.pathname;
            return url.pathname;
        case "tags":
        case "hostandpath":
            if (url.host === "media.discordapp.net" || url.host === "tenor.com")
                return `${url.host} ${url.pathname.split("/").at(-1) ?? url.pathname}`;
            return `${url.host} ${url.pathname}`;

        default:
            return "";
    }
}

function fuzzySearch(searchQuery: string, searchString: string) {
    let searchIndex = 0;
    let score = 0;

    for (let i = 0; i < searchString.length; i++) {
        if (searchString[i] === searchQuery[searchIndex]) {
            score++;
            searchIndex++;
        } else {
            score--;
        }

        if (searchIndex === searchQuery.length) {
            return score;
        }
    }

    return null;
}

function findTag(name: string) {
    return gifTags.find(t => t.name === name || t.alternateNames.includes(name));
}

function sortByCategory(a: string, b: string) {
    const aCategory = findTag(a)?.category ?? "general";
    const bCategory = findTag(b)?.category ?? "general";

    const aCategoryIndex = tagCategories.indexOf(aCategory);
    const bCategoryIndex = tagCategories.indexOf(bCategory);

    return bCategoryIndex - aCategoryIndex;
}

function matchesTags(searchQuery: string, tags: string[]) {
    console.count("matchesTags");
    console.log(searchQuery, tags);
    const searchTags = searchQuery.split(" ").map(tag => tag.toLowerCase()).map(t => t.trim()).filter(Boolean);

    const hasExcludedTag = searchTags
        .filter(tag => tag.startsWith("-"))
        .some(tag => isTagInCollection(tag.substring(1), tags));

    if (hasExcludedTag) return false;

    const allPositiveTagsIncluded = searchTags
        .filter(tag => !tag.startsWith("-") || !tag.startsWith(""))
        .every(tag => isTagInCollection(tag, tags));

    const optionalTagIncluded = searchTags
        .filter(tag => tag.startsWith("?"))
        .some(tag => isTagInCollection(tag.substring(1), tags));

    return allPositiveTagsIncluded || optionalTagIncluded;
}

function isTagInCollection(tagName: string, collection: string[]) {
    const foundTag = findTag(tagName);
    if (!foundTag) return collection.includes(tagName);

    return collection.includes(foundTag.name) ||
        foundTag.alternateNames.some(alt => collection.includes(alt));
}
